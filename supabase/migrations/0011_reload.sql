-- רענון מטמון הסכימה של PostgREST.
-- המלכודת שתועדה פעמיים: אחרי ALTER TABLE הוא ממשיך להחזיר
-- "column does not exist", והמסכים מציגים אפס שורות בלי שום שגיאה.
notify pgrst, 'reload schema';
