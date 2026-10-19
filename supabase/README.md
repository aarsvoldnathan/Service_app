# Online database (Supabase project "Service Ceo")

The schema lives in the Supabase project `hzicabjeqprtiolsvxbn` and was applied as migrations
`crew_accounts_and_private_billing` and `join_fleet_unique_technician_id`.

- `fleets`: one row per fleet, with its owner and invite code.
- `fleet_members`: who is in which fleet, as `owner`, `manager` or `technician`, linked to a technician profile.
- `records`: every machine, schedule item, service log, assignment, shopping item, job, time entry, expense
  and hourly rate, stored as JSON per fleet.

Privacy is enforced by row-level security in the database, not just in the app:
`jobs`, `timeEntries`, `expenses` and `rates` rows are readable only by the fleet owner and by the
technician they belong to. Technicians cannot change their own hourly rate, write rows for someone
else, change fleet settings or change roles.
