'use strict';
const _ = require('lodash');
const joi = require('joi');
const staff_designations = ["nurse", "compounder", "cashier", "receptionist", "admin", "doctor"];
const doctor_designations = ['', 'Allergist', 'Anaesthesiologist', 'Andrologist', 'Cardiologist',
                       'Cardiac Electrophysiologist', 'Dermatologist', 'Emergency Room (ER) Doctors',
                       'Endocrinologist', 'Epidemiologist', 'Family Medicine Physician', 'Gastroenterologist',
                       'Geriatrician', 'Hyperbaric Physician', 'Hematologist', 'Hepatologist', 'Immunologist',
                       'Infectious Disease Specialist', 'Intensivist', 'Internal Medicine Specialist',
                       'Maxillofacial Surgeon / Oral Surgeon', 'Medical Examiner', 'Medical Geneticist',
                       'Neonatologist', 'Nephrologist', 'Neurologist', 'Neurosurgeon',
                       'Nuclear Medicine Specialist', 'Obstetrician/Gynecologist (OB/GYN)',
                       'Occupational Medicine Specialist', 'Oncologist', 'Ophthalmologist',
                       'Orthopedic Surgeon / Orthopedist', 'Otolaryngologist (also ENT Specialist)',
                       'Parasitologist', 'Pathologist', 'Perinatologist', 'Periodontist', 'Pediatrician',
                       'Physiatrist', 'Plastic Surgeon', 'Psychiatrist', 'Pulmonologist', 'Radiologist',
                       'Rheumatologist', 'Sleep Doctor / Sleep Disorders Specialist',
                       'Spinal Cord Injury Specialist', 'Sports Medicine Specialist', 'Surgeon', 'Thoracic Surgeon',
                       'Urologist', 'Vascular Surgeon', 'Veterinarian', 'Acupuncturist', 'Audiologist',
                       'Ayurvedic Practioner', 'Chiropractor', 'Diagnostician', 'Homeopathic Doctor',
                       'Microbiologist', 'Naturopathic Doctor', 'Palliative care specialist', 'Pharmacist',
                       'Physiotherapist', 'Podiatrist / Chiropodist', 'Registered Massage Therapist'];

module.exports = {
  schema: {
    // Describe the attributes with joi here
    _key: joi.string(),
    first_name: joi.string().required(),
    last_name: joi.string().required(),
    birth_date: joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).required(),
    ssn: joi.string().regex(/^\d{3}-\d{2}-\d{4}$/).required(),
    email: joi.string().email({ minDomainAtoms: 2 }),
    address: joi.object().keys( {
      zip: joi.string().required(),
      country: joi.string().required(),
      city: joi.string().required(),
      street: joi.string().required(),
      building: joi.string().required()
    }),
    designation: joi.string().allow(staff_designations),
    doctor_designation: joi.string().allow(doctor_designations)
  },
  forClient(obj) {
    // Implement outgoing transformations here
    obj = _.omit(obj, ['_id', '_rev', '_oldRev']);
    return obj;
  },
  fromClient(obj) {
    // Implement incoming transformations here
    return obj;
  }
};
