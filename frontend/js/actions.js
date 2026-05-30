// frontend/js/actions.js
// Este archivo contiene variables de compatibilidad.
// Toda la lógica real está centralizada en app.js (App object).

// Variables globales de estado (compatibilidad con código legado)
let priResult     = null;
let medRowCount   = 0;
let activeCitaId  = null;
let invEditId     = null;
let ratingFormulaId = null;
let selectedStars = 0;

// ALERGIAS conocidas del paciente demo (también en utils.js como ALERGIAS_CONOCIDAS)
const ALERGIAS = ['penicilina', 'ibuprofeno'];
