import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from models.database import get_expected_durations, get_db
db = get_db()
resp = db.table('events').select('checkpoint, duration_mins').execute()
print("Raw events:", len(resp.data))
for e in resp.data[:10]:
    print(e)
print("Durations:", get_expected_durations())
