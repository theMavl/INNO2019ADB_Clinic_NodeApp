from pyArango.connection import *

conn = Connection(arangoURL='http://10.90.137.225:8529', username="man", password="clinicc")
db = conn["Clinic"]
