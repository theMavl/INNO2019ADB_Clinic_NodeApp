import pyArango.collection as col
import pyArango.validation as val
import datetime
from pyArango.theExceptions import ValidationError
from re import search
from connector import db
from enumerators import *


class DatetimePastVal(val.Validator):
    def validate(self, value):

        if not isinstance(value, datetime.date):
            try:
                value = datetime.datetime.strptime(value, '%Y-%m-%d').date()
            except ValueError:
                raise ValidationError("Datetime should be formatted as YYYY-MM-DD")
        dt = datetime.date.today()
        if value >= dt:
            raise ValidationError("Date is not at the past")
        return True


class DatetimeVal(val.Validator):
    def validate(self, value):
        if value == "" or value is None:
            return True
        if not isinstance(value, datetime.date):
            try:
                datetime.datetime.strptime(value, '%Y-%m-%d')

            except ValueError:
                raise ValidationError("Datetime should be formatted as YYYY-MM-DD. Current: " + value)
        return True


class PatientEmailUniqueVal(val.Validator):
    def validate(self, value):
        patients = db["Patients"]

        query = patients.fetchByExample({'email': value}, batchSize=1, count=True)

        if query.count != 0:
            raise ValidationError("This email is already registered in the system")
        return True


class StaffEmailUniqueVal(val.Validator):
    def validate(self, value):
        staff = db["Staff"]

        query = staff.fetchByExample({'email': value}, batchSize=1, count=True)

        if query.count != 0:
            raise ValidationError("This email is already registered in the system")
        return True


class SSNVal(val.Validator):
    def validate(self, value):
        if search('\d\d\d-\d\d-\d\d\d\d', value) is None:
            raise ValidationError('SSN should be formatted as 123-45-6789')


class AddressVal(val.Validator):
    required_fields = ["zip", "country", "city", "street", "building"]

    def validate(self, value):
        for field in self.required_fields:
            if field not in value:
                raise ValidationError(field.capitalize(), 'is missing')


class PatientIDExists(val.Validator):
    def validate(self, value):
        patients = db["Patients"]
        patient = patients.fetchFirstExample({'_key': str(value)})

        if not patient:
            raise ValidationError("Patient ID doesn't exist")
        return True


class DoctorIDExists(val.Validator):
    def validate(self, value):
        if value is None or value == "":
            return True

        staff = db["Staff"]
        member = staff.fetchFirstExample({'_key': str(value)})

        if not member:
            raise ValidationError("Doctor ID doesn't exist")
        else:
            member = member[0]
            if member["designation"] != "doctor":
                raise ValidationError("Doctor ID doesn't exist")
        return True


class StaffIDExists(val.Validator):
    def validate(self, value):
        if value is None or value == "":
            return True

        staff = db["Staff"]
        member = staff.fetchFirstExample({'_key': str(value)})

        if not member:
            raise ValidationError("Staff ID doesn't exist")
        return True


class SecurityQuestionsVal(val.Validator):
    def validate(self, value):
        if not isinstance(value, list):
            raise ValidationError("Not a list")
        if len(value) == 0:
            raise ValidationError("Empty list")

        for q in value:
            if "question" not in q or "answer" not in q:
                raise ValidationError("Bad object format")

            if q["question"] == "":
                raise ValidationError("Empty question")
            if q["answer"] == "":
                raise ValidationError("Empty answer")

        return True


class Tips(col.Collection):
    _validation = {
        'on_save': True,
        'on_set': True,
        'allow_foreign_fields': True  # allow fields that are not part of the schema
    }

    _fields = {
        'name': col.Field(validators=[val.NotNull()])
    }


class Patients(col.Collection):
    _validation = {
        'on_save': True,
        'on_set': True,
        'allow_foreign_fields': True  # allow fields that are not part of the schema
    }

    _fields = {
        'email': col.Field(validators=[val.NotNull(), val.Email(), PatientEmailUniqueVal()]),
        'password': col.Field(validators=[val.NotNull()]),
        'first_name': col.Field(validators=[val.NotNull()]),
        'last_name': col.Field(validators=[val.NotNull()]),
        'birth_date': col.Field(validators=[val.NotNull(), DatetimePastVal()]),
        'ssn': col.Field(validators=[val.NotNull(), SSNVal()]),
        'address': col.Field(validators=[val.NotNull(), AddressVal()]),
        'phone_number': col.Field(validators=[val.NotNull()]),
        'security_questions': col.Field(validators=[val.NotNull(), SecurityQuestionsVal()]),
    }


class Visitors(col.Collection):
    _validation = {
        'on_save': True,
        'on_set': True,
        'allow_foreign_fields': True  # allow fields that are not part of the schema
    }

    _fields = {
        'first_name': col.Field(validators=[val.NotNull()]),
        'last_name': col.Field(validators=[val.NotNull()]),
        'registered': col.Field(validators=[val.Bool()]),
        'visited_date': col.Field(validators=[val.NotNull(), DatetimeVal()]),
    }


class Appointments(col.Collection):
    _validation = {
        'on_save': True,
        'on_set': True,
        'allow_foreign_fields': True  # allow fields that are not part of the schema
    }

    _fields = {
        'patient': col.Field(validators=[val.NotNull(), PatientIDExists()]),
        'doctor': col.Field(validators=[DoctorIDExists()]),
        'symptoms': col.Field(validators=[val.NotNull()]),
        'description': col.Field(validators=[val.NotNull()]),
        'date_created': col.Field(validators=[val.NotNull(), DatetimeVal()]),
        'since_when': col.Field(validators=[val.NotNull(), DatetimeVal()]),
        'payment_type': col.Field(validators=[val.NotNull(), val.Enumeration(payment_types)]),
        'payed': col.Field(validators=[val.NotNull(), val.Bool()]),
        'urgent': col.Field(validators=[val.Bool()]),
        'status': col.Field(validators=[val.NotNull(), val.Enumeration(appointment_status)]),
        'appointment_date': col.Field(validators=[DatetimeVal()]),
        'cancel_reason': col.Field(),
        'reject_reason': col.Field(),
    }


class Staff(col.Collection):
    _validation = {
        'on_save': True,
        'on_set': False,
        'allow_foreign_fields': True  # allow fields that are not part of the schema
    }

    _fields = {
        'email': col.Field(validators=[val.NotNull(), val.Email(), StaffEmailUniqueVal()]),
        'password': col.Field(validators=[val.NotNull()]),
        'first_name': col.Field(validators=[val.NotNull()]),
        'last_name': col.Field(validators=[val.NotNull()]),
        'birth_date': col.Field(validators=[val.NotNull(), DatetimePastVal()]),
        'ssn': col.Field(validators=[val.NotNull(), SSNVal()]),
        'address': col.Field(validators=[val.NotNull(), AddressVal()]),
        'phone_number': col.Field(validators=[val.NotNull()]),
        'designation': col.Field(validators=[val.NotNull(), val.Enumeration(staff_designations)]),
        'doctor_designation': col.Field(validators=[val.Enumeration(doctor_designations)]),
        'security_questions': col.Field(validators=[val.NotNull(), SecurityQuestionsVal()]),
    }


class LeaveApply(col.Collection):
    _validation = {
        'on_save': True,
        'on_set': True,
        'allow_foreign_fields': True  # allow fields that are not part of the schema
    }

    _fields = {
        'member': col.Field(validators=[val.NotNull(), StaffIDExists()]),
        'leave_reason': col.Field(validators=[val.NotNull(), val.String]),
        'beginning_date': col.Field(validators=[val.NotNull(), DatetimeVal()]),
        'ending_date': col.Field(validators=[val.NotNull(), DatetimeVal()]),
        'status': col.Field(validators=[val.NotNull()])
    }


class MemberOf(col.Collection):
    _validation = {
        'on_save': True,
        'on_set': True,
        'allow_foreign_fields': True  # allow fields that are not part of the schema
    }

    _fields = {
        '_from': col.Field(validators=[val.NotNull()]),
        '_to': col.Field(validators=[val.NotNull()])
    }


class IsAppointed(col.Collection):
    _validation = {
        'on_save': True,
        'on_set': True,
        'allow_foreign_fields': True  # allow fields that are not part of the schema
    }

    _fields = {
        '_from': col.Field(validators=[val.NotNull()]),
        '_to': col.Field(validators=[val.NotNull()])
    }


class Facilities(col.Collection):
    _validation = {
        'on_save': True,
        'on_set': True,
        'allow_foreign_fields': True  # allow fields that are not part of the schema
    }

    _fields = {
        'model': col.Field(validators=[val.NotNull()]),
        'description': col.Field(validators=[val.NotNull()])
    }