/* =============================================
   MAIN.JS — Dark theme + PDF generation
   ============================================= */

/* ---- Dark / Light theme ---- */
const themeButton = document.getElementById('theme-button');
const DARK_CLASS  = 'dark-theme';

// Restore saved preference
const savedTheme = localStorage.getItem('cv-theme');
if (savedTheme === 'dark') document.body.classList.add(DARK_CLASS);

themeButton.addEventListener('click', () => {
  document.body.classList.toggle(DARK_CLASS);
  localStorage.setItem('cv-theme',
    document.body.classList.contains(DARK_CLASS) ? 'dark' : 'light'
  );
});

/* ---- PDF generation ---- */
const resumeButton = document.getElementById('resume-button');
const printButton   = document.getElementById('print-button');
const areaCv       = document.getElementById('area-cv');

/* Imprimir / Guardar como PDF nativo del navegador.
   A diferencia de html2pdf (imagen), esto genera un PDF con texto
   real y seleccionable, usando las reglas de @media print del CSS.
   También activamos el modo compacto (scale-cv) para que el tamaño
   de letra sea consistente con el otro botón de descarga. */
printButton.addEventListener('click', () => {
  window.print();
});

window.addEventListener('beforeprint', addScaleClass);
window.addEventListener('afterprint', removeScaleClass);

const pdfOptions = {
  margin:      [8, 9, 8, 9],
  filename:    'CV_Brandon-Rodriguez-Jimenez.pdf',
  image:       { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true },
  jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak:   { mode: ['css', 'legacy'], avoid: ['.cv-entry-header', '.cv-entry-subheader', '.cv-skill-row', '.cv-bullets li'] }
};

function addScaleClass()    { document.body.classList.add('scale-cv'); }
function removeScaleClass() { document.body.classList.remove('scale-cv'); }

resumeButton.addEventListener('click', () => {
  addScaleClass();
  // Esperamos a que las fuentes web (EB Garamond / DM Sans) terminen de
  // cargar antes de capturar el DOM. Si html2canvas captura con la fuente
  // aún sin cargar, usa métricas de la fuente de reemplazo y el texto
  // termina sobrepuesto/encimado al reflotar con la fuente real.
  document.fonts.ready
    .then(() => new Promise(resolve => setTimeout(resolve, 50))) // margen extra de reflow
    .then(() => html2pdf().set(pdfOptions).from(areaCv).save())
    .then(removeScaleClass)
    .catch(err => { console.error(err); removeScaleClass(); });
});
