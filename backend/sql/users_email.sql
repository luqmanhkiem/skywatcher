-- SkyWatcher — add an email column to staff/admin accounts
-- Critical-anomaly alerts (SECURITY_BYPASS) are emailed to every active
-- admin/ground_staff account that has an email set here.
-- Run this once in the Supabase SQL editor (Database → SQL Editor).

alter table users add column if not exists email text;

-- Optional: set emails for the seeded demo accounts so alerts have a recipient.
-- update users set email = 'you@gmail.com'        where username = 'admin';
-- update users set email = 'staff.one@gmail.com'  where username = 'staff1';
-- update users set email = 'staff.two@gmail.com'  where username = 'staff2';
