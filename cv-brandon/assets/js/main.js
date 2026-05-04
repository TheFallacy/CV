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
const areaCv       = document.getElementById('area-cv');

const pdfOptions = {
  margin:      [10, 10, 10, 10],
  filename:    'CV_Brandon-Rodriguez-Jimenez.pdf',
  image:       { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true },
  jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak:   { mode: ['css', 'legacy'] }
};

function addScaleClass()    { document.body.classList.add('scale-cv'); }
function removeScaleClass() { document.body.classList.remove('scale-cv'); }

resumeButton.addEventListener('click', () => {
  addScaleClass();
  html2pdf()
    .set(pdfOptions)
    .from(areaCv)
    .save()
    .then(removeScaleClass)
    .catch(err => { console.error(err); removeScaleClass(); });
});
