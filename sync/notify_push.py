"""
Send a Web Push for jobs that arrived and have not been announced yet.

Runs at the end of a sync or a scan. `jobs.notified_at` is the marker, so a job
is announced once no matter how many times it is re-seen, and a run that dies
before sending leaves the job to be picked up by the next one rather than
dropping it.

One notification per batch, not per job: 47 arriving at once is one useful
sentence and forty-seven useless buzzes.
"""
import base64, json, os, sys, time
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q

MAX_TITLES = 3          # named in the body; the rest are counted
SITE = os.environ.get("SITE_URL", "https://situation-room-pied.vercel.app")


def vapid():
    if os.environ.get("VAPID_PRIVATE_KEY"):
        return os.environ["VAPID_PUBLIC_KEY"], os.environ["VAPID_PRIVATE_KEY"]
    with open(os.path.expanduser("~/.situation-room/vapid.json")) as fh:
        d = json.load(fh)
    return d["publicKey"], d["privateKey"]


def b64u(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def unb64u(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def sign_jwt(audience, private_key_b64, subject="mailto:shaul.mano@gmail.com"):
    """VAPID auth header. ES256 over {aud, exp, sub}."""
    from cryptography.hazmat.primitives.asymmetric import ec, utils
    from cryptography.hazmat.primitives import hashes

    header = b64u(json.dumps({"typ": "JWT", "alg": "ES256"}, separators=(",", ":")).encode())
    payload = b64u(json.dumps(
        {"aud": audience, "exp": int(time.time()) + 12 * 3600, "sub": subject},
        separators=(",", ":"),
    ).encode())
    signing_input = f"{header}.{payload}".encode()

    key = ec.derive_private_key(int.from_bytes(unb64u(private_key_b64), "big"), ec.SECP256R1())
    der = key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
    r, s = utils.decode_dss_signature(der)
    raw_sig = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return f"{header}.{payload}.{b64u(raw_sig)}"


def encrypt(payload: bytes, p256dh: str, auth: str):
    """aes128gcm, per RFC 8291."""
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    client_pub_raw = unb64u(p256dh)
    auth_secret = unb64u(auth)
    client_pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), client_pub_raw)

    server_key = ec.generate_private_key(ec.SECP256R1())
    server_pub_raw = server_key.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    shared = server_key.exchange(ec.ECDH(), client_pub)
    salt = os.urandom(16)

    prk = HKDF(
        algorithm=hashes.SHA256(), length=32, salt=auth_secret,
        info=b"WebPush: info\x00" + client_pub_raw + server_pub_raw,
    ).derive(shared)

    cek = HKDF(algorithm=hashes.SHA256(), length=16, salt=salt,
               info=b"Content-Encoding: aes128gcm\x00").derive(prk)
    nonce = HKDF(algorithm=hashes.SHA256(), length=12, salt=salt,
                 info=b"Content-Encoding: nonce\x00").derive(prk)

    ciphertext = AESGCM(cek).encrypt(nonce, payload + b"\x02", None)
    header = salt + (4096).to_bytes(4, "big") + bytes([len(server_pub_raw)]) + server_pub_raw
    return header + ciphertext


def send(sub, body: dict, pub_key: str, priv_key: str):
    import subprocess, tempfile
    endpoint = sub["endpoint"]
    origin = "{0.scheme}://{0.netloc}".format(urlparse(endpoint))
    encrypted = encrypt(json.dumps(body).encode(), sub["p256dh"], sub["auth"])
    token = sign_jwt(origin, priv_key)

    fd, path = tempfile.mkstemp()
    with os.fdopen(fd, "wb") as fh:
        fh.write(encrypted)
    try:
        out = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", endpoint,
             "-H", "Content-Encoding: aes128gcm",
             "-H", "Content-Type: application/octet-stream",
             "-H", "TTL: 86400",
             "-H", f"Authorization: vapid t={token}, k={pub_key}",
             "--data-binary", f"@{path}"],
            capture_output=True, text=True, timeout=60,
        ).stdout.strip()
    finally:
        os.unlink(path)
    return out


def main():
    subs = sql("select endpoint, p256dh, auth from push_subscriptions where failures < 5")
    if not subs:
        print("no push subscriptions")
        return

    rows = sql(
        "select j.id, j.title, j.company from jobs j "
        "where j.on_target and j.dismissed_at is null and j.notified_at is null "
        "and j.first_seen >= now() - interval '2 days' "
        "and exists (select 1 from matches m where m.job_id = j.id) "
        "order by j.first_seen desc limit 60"
    )
    if not rows:
        print("nothing new to announce")
        return

    names = " · ".join((r["title"] or "")[:38] for r in rows[:MAX_TITLES])
    extra = len(rows) - MAX_TITLES
    body = {
        "title": f"{len(rows)} משרות חדשות" if len(rows) > 1 else "משרה חדשה",
        "body": names + (f" ועוד {extra}" if extra > 0 else ""),
        "url": "/",
        "tag": "new-jobs",
    }

    pub, priv = vapid()
    ok = 0
    for sub in subs:
        code = send(sub, body, pub, priv)
        print(f"  {sub['endpoint'][:48]}… -> {code}")
        if code in ("201", "200"):
            ok += 1
            sql("update push_subscriptions set last_ok = now(), failures = 0 where endpoint = %s"
                % q(sub["endpoint"]))
        elif code in ("404", "410"):
            # The device unsubscribed or the endpoint expired; stop writing to it.
            sql("delete from push_subscriptions where endpoint = %s" % q(sub["endpoint"]))
        else:
            sql("update push_subscriptions set failures = failures + 1 where endpoint = %s"
                % q(sub["endpoint"]))

    # Mark regardless: a job announced to nobody should not queue up and arrive
    # as a hundred-job notification the day a device finally subscribes.
    ids = ",".join(q(r["id"]) for r in rows)
    sql(f"update jobs set notified_at = now() where id in ({ids})")
    print(f"announced {len(rows)} jobs to {ok}/{len(subs)} devices")


if __name__ == "__main__":
    main()
