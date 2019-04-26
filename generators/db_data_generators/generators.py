from random import randint, choices

import pandas as pd
from faker import Faker
from tqdm import tqdm
from default_fields import *
from enumerators import *
from validators import *


def generate_staff(db_conn):
    staff = db_conn["clinic_Staff"]
    perm = db_conn["clinic_memberOf"]
    fake = Faker()
    admin_exists = False

    all_addresses = pd.read_csv('Streets.csv')
    n_houses = len(all_addresses)
    # Create dummy staff for referencing
    # st = staff.createDocument()
    # st["_id"] = 0
    # st["NULL"] = True
    # st.save()

    for i in range(300):
        address = all_addresses.iloc[randint(0, n_houses - 1)]

        st = Staff.createDocument(staff)
        st["ssn"] = fake.ssn(taxpayer_identification_number_type="SSN")
        try:
            st["email"] = fake.word() + fake.word() + "@" + fake.word() + fake.word() + ".ru"
        except ValidationError:
            st["email"] = fake.word() + fake.word() + "@" + fake.word() + fake.word() + ".ru"

        st["first_name"] = fake.first_name()
        st["last_name"] = fake.last_name()
        st["phone_number"] = fake.phone_number()
        st["birth_date"] = fake.date_between(start_date="-90y", end_date="-18y")
        st["address"] = {"zip": address['zip_code'], "country": 'Россия', "state": 'Республика Татарстан',
                         "city": 'Казань', "street": address['street'], "building": address['house'],
                         "flat": randint(1, 1000)}
        st["authData"] = {"method": "sha256",
                          "salt": "W5i/Zy7G(BTPjZ,w",
                          "hash": "beac9317a9808becae1ef1b7b0bedff85a381ca38501e7d1841d7c88609424af"
                          }

        r = randint(1, 10)
        if r == 1:
            # doctor
            st["designation"] = "doctor"
            st["doctor_designation"] = doctor_designations[randint(0, len(doctor_designations) - 1)]
            mo = MemberOf.createDocument(perm)
            mo["_from"] = "clinic_Staff/" + str(st["_key"])
            mo["_to"] = "clinic_Usergroups/2756076"
            mo.save()
        else:
            if not admin_exists:
                st["designation"] = staff_designations[-2]
                admin_exists = True
            else:
                st["designation"] = staff_designations[randint(0, len(staff_designations) - 3)]
            mo = MemberOf.createDocument(perm)
            mo["_from"] = "clinic_Staff/" + str(st["_key"])
            mo["_to"] = "clinic_Usergroups/2673975"
            mo.save()

        rq = randint(1, 4)
        sql = []
        for i in range(rq):
            sql.append({"question": str(fake.text())[:-1] + "?", "answer": fake.word()})

        st["security_questions"] = sql
        st.save()


def generate_tips(db_conn):
    tips = db_conn["clinic_Tips"]
    fake = Faker()
    for i in range(1000):
        tip = tips.createDocument()
        tip["text"] = fake.text()
        tip.save()


def generate_appointments(db_conn):
    appointments = db_conn["clinic_Appointments"]
    patients = db_conn["clinic_Patients"]
    staff = db_conn["clinic_Staff"]

    df = pd.read_csv('Streets.csv')
    keys = list(map(lambda x: f'{x[0]}, {x[1]}', df[['street', 'house']].to_numpy()))
    street_coord = {}
    for key, value in zip(keys, df[['longitude', 'latitude']].to_numpy()):
        street_coord[key] = list(value)

    fake = Faker()

    for i in tqdm(range(5000), desc='appointments'):
        aql_p = "FOR x IN clinic_Patients SORT RAND() LIMIT 1 RETURN x"
        aql_d = "FOR x IN clinic_Staff SORT RAND() FILTER x.designation == 'doctor' LIMIT 1 RETURN x"
        doctor = db_conn.AQLQuery(aql_d, rawResults=True, batchSize=100)[0]
        patient = db_conn.AQLQuery(aql_p, rawResults=True, batchSize=100)[0]

        patient = patients[patient["_key"]]
        doctor = staff[doctor["_key"]]
        address = patient["address"]
        address = address['street'] + ', ' + address['building']

        appointment = Appointments.createDocument(appointments, default_appointment)

        appointment["patient"] = patient._key

        appointment["symptoms"] = choices(symptoms, k=randint(1, 3))
        appointment["description"] = fake.text()
        created_date = fake.date_between(start_date="-90d", end_date="today")
        appointment["date_created"] = created_date
        appointment["since_when"] = fake.date_between(start_date="-2y", end_date=created_date)
        r = randint(0, 2)
        appointment["payment_type"] = payment_types[r]
        appointment['residential_area'] = street_coord[address]

        if r == 2:
            appointment["payed"] = True
        else:
            appointment["payed"] = True if randint(0, 1) == 1 else False

        appointment["urgent"] = True if randint(0, 100) == 1 else False

        r = randint(0, 4)
        appointment["status"] = appointment_status[r]
        if r == 2:
            appointment["doctor"] = doctor._key
            appointment["appointment_date"] = fake.date_between(start_date="today", end_date="+180d")
        elif r == 3:
            appointment["doctor"] = doctor._key
            appointment["appointment_date"] = fake.date_between(start_date=created_date, end_date="today")
        elif r == 4:
            appointment["reject_reason"] = fake.text()
        # else:
        #     appointment["appointment_date"] = None
        #     appointment["doctor"] = None
        appointment.save()


def generate_event(db_conn):
    event = {}
    fake = Faker()
    r = randint(1, 3)
    event['name'] = ' '.join(fake.words(randint(1, 3)))
    event['type'] = event_types[randint(0, len(event_types) - 1)]
    event['description'] = ' '.join(fake.sentences(randint(1, 3)))
    return event


def generate_facilities(db_conn):
    fake = Faker()
    facilities = db_conn["clinic_Facilities"]
    for i in range(100):
        fac = Facilities.createDocument(facilities)
        fac["model"] = fake.license_plate()
        fac["description"] = fake.text()
        fac.save()


def generate_timetable(db_conn):
    aql = "FOR x IN clinic_Staff FILTER x.designation == 'doctor' RETURN x"
    queryResult = db_conn.AQLQuery(aql, rawResults=True, batchSize=100)

    timetableCollection = db_conn["clinic_isAppointed"]
    appointments = db_conn["clinic_Appointments"].fetchAll()
    is_appointed = db_conn["clinic_isAppointed"]
    timetableCollection.truncate()

    fake = Faker()
    for i in range(10):
        for doctor in queryResult:
            appointment = appointments[randint(0, len(appointments) - 1)]
            doc = IsAppointed.createDocument(is_appointed)
            doc['_from'] = "clinic_Staff/" + str(doctor["_key"])
            doc['_to'] = "clinic_Appointments/" + str(appointment["_key"])
            doc['date'] = fake.date_between(start_date="-90y", end_date="today")
            doc['description'] = fake.text()
            doc['time'] = str(fake.time())[:5]
            doc.save()


def generate_leave_applies(db_conn):
    applies = db_conn["clinic_LeaveApply"]
    staff = db_conn["clinic_Staff"]

    fake = Faker()
    aql_a = "FOR x IN clinic_Staff SORT RAND() FILTER x.designation == 'admin' LIMIT 1 RETURN x"
    admin = db_conn.AQLQuery(aql_a, rawResults=True, batchSize=100)[0]
    admin = staff[admin["_key"]]

    for i in range(500):
        aql_s = "FOR x IN clinic_Staff SORT RAND() LIMIT 1 RETURN x"

        member = db_conn.AQLQuery(aql_s, rawResults=True, batchSize=100)[0]

        member = staff[member["_key"]]

        la = applies.createDocument()

        la["member"] = int(member['_key'])

        la["leave_reason"] = fake.text()

        begin_date = fake.date_between(start_date="today", end_date="+180d")
        la["beginning_date"] = begin_date

        la["ending_date"] = fake.date_between(start_date=begin_date, end_date="+1y")

        r = randint(0, 2)

        la["status"] = leave_apply_status[r]

        if r != 0:
            la["reviewed_by"] = int(admin['_key'])

        if r == 2:
            la["reject_reason"] = fake.text()

        la.save()


def generate_home_remedies(db_conn):
    remedies = db_conn["clinic_HomeRemedies"]
    fake = Faker()

    for i in range(2000):
        remedy = remedies.createDocument()
        remedy["description"] = fake.text()
        remedy["symptoms"] = choices(symptoms, k=randint(1, 5))
        remedy["actions"] = fake.text()
        remedy.save()


def generate_visitors_patients(db_conn):
    patients = db_conn["clinic_Patients"]
    visitors = db_conn["clinic_Visitors"]
    perm = db_conn["clinic_memberOf"]
    fake = Faker()
    all_addresses = pd.read_csv('Streets.csv')
    n_houses = len(all_addresses)

    keys = list(map(lambda x: f'{x[0]}, {x[1]}', all_addresses[['street', 'house']].to_numpy()))
    street_coord = {}
    for key, value in zip(keys, all_addresses[['longitude', 'latitude']].to_numpy()):
        street_coord[key] = list(value)

    for i in tqdm(range(10000), desc='visitors_patients'):
        r = randint(1, 100)
        d = randint(0, 1)
        address = all_addresses.iloc[randint(0, n_houses - 1)]

        # 3 cases:
        # visited and registered (r == 1)
        # visited but not registered (r != 1 and d == 0)
        # not visited but registered (r != 1 and d == 1)

        fname = fake.first_name()
        lname = fake.last_name()

        if r == 1 or (r != 1 and d == 0):
            # visited & registered as patient
            # visitor = visitors.createDocument()
            visitor = Visitors.createDocument(visitors)
            visitor["first_name"] = fname
            visitor["last_name"] = lname
            visitor["visited_date"] = fake.date_between(start_date="-2y", end_date="-1d")
            if r == 1:
                visitor["registered"] = True
            else:
                visitor["registered"] = False
            visitor.save()

        if r == 1 or (r != 1 and d == 1):

            # doc = patients.createDocument()
            doc = Patients.createDocument(patients)
            try:
                doc["email"] = fake.word() + fake.word() + "@" + fake.word() + fake.word() + ".ru"
            except ValidationError:
                doc["email"] = fake.word() + fake.word() + "@" + fake.word() + fake.word() + ".ru"
            doc["first_name"] = fname
            doc["last_name"] = lname
            doc["phone_number"] = fake.phone_number()
            doc["birth_date"] = fake.date_between(start_date="-90y", end_date="-18y")
            doc["ssn"] = fake.ssn(taxpayer_identification_number_type="SSN")
            doc["address"] = {"zip": address['zip_code'], "country": 'Россия', "state": 'Республика Татарстан',
                              "city": 'Казань', "street": address['street'], "building": address['house'],
                              "flat": randint(1, 1000)}

            address = address['street'] + ', ' + address['house']
            doc['residential_area'] = street_coord[address]
            doc["authData"] = {"method": "sha256",
                               "salt": "W5i/Zy7G(BTPjZ,w",
                               "hash": "beac9317a9808becae1ef1b7b0bedff85a381ca38501e7d1841d7c88609424af"
                               }

            rq = randint(1, 4)
            sql = []
            for i in range(rq):
                sql.append({"question": str(fake.text())[:-1] + "?", "answer": fake.word()})

            doc["security_questions"] = sql

            doc.save()
            mo = MemberOf.createDocument(perm)
            mo["_from"] = "clinic_Patient/" + str(doc["_key"])
            mo["_to"] = "clinic_Usergroups/2042765"
            mo.save()
