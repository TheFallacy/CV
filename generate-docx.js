/**
 * generate-docx.js
 * Genera un CV en .docx (ATS-friendly: una sola columna, sin tablas ni
 * cuadros de texto, encabezados nativos de Word) a partir de index.html.
 *
 * Uso:
 *   npm install          (una sola vez; instala docx + cheerio)
 *   node generate-docx.js
 *
 * Salida:
 *   ./output/CV_<slug>_ATS.docx
 *
 * El script está acoplado a las clases semánticas de tu index.html
 * (.cv-header, .cv-section, .cv-entry, .cv-bullets, .cv-skills, etc.).
 * Si agregas una sección nueva reutilizando esas mismas clases, el
 * script la recoge automáticamente sin tocar código.
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, convertInchesToTwip,
} = require("docx");

const SOURCE_HTML = path.join(__dirname, "index.html");
const OUTPUT_DIR = path.join(__dirname, "output");

const FONT = "Calibri";
const NAVY = "1F3864";
const DARK = "1A1A1A";
const hairline = { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 4 } };

// ---------- helpers de construcción de párrafos ----------

const sectionHeading = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 120 },
    border: hairline,
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: NAVY, size: 24, font: FONT })],
  });

const entryHeader = (org, location) =>
  new Paragraph({
    spacing: { before: 200, after: 20 },
    tabStops: [{ type: "right", position: convertInchesToTwip(6.4) }],
    children: [
      new TextRun({ text: org, bold: true, size: 22, font: FONT, color: DARK }),
      ...(location ? [new TextRun({ text: `\t${location}`, size: 20, font: FONT, color: "555555" })] : []),
    ],
  });

const entrySubheader = (role, date) =>
  new Paragraph({
    spacing: { before: 100, after: 60 },
    tabStops: [{ type: "right", position: convertInchesToTwip(6.4) }],
    children: [
      new TextRun({ text: role, bold: true, italics: true, size: 20, font: FONT, color: "333333" }),
      ...(date ? [new TextRun({ text: `\t${date}`, italics: true, size: 20, font: FONT, color: "555555" })] : []),
    ],
  });

const bullet = (text) =>
  new Paragraph({
    spacing: { after: 60 },
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 20, font: FONT, color: DARK })],
  });

const plain = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 80 },
    children: [new TextRun({ text, size: opts.size ?? 20, font: FONT, color: DARK, bold: !!opts.bold })],
  });

// ---------- parseo del HTML ----------

function parseCV(html) {
  const $ = cheerio.load(html);
  const children = [];

  // Header
  const name = $(".cv-name").first().text().trim();
  const title = $(".cv-title").first().text().replace(/\s+/g, " ").trim();
  const contactParts = [];
  $(".cv-contact")
    .first()
    .children()
    .each((_, node) => {
      const t = $(node).text().trim();
      if (t && t !== "•") contactParts.push(t);
    });

  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: name, bold: true, size: 36, font: FONT, color: NAVY })],
    })
  );
  if (title) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: title, size: 22, font: FONT, color: "333333" })],
      })
    );
  }
  if (contactParts.length) {
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: contactParts.join("  |  "), size: 19, font: FONT, color: "444444" })],
      })
    );
  }

  // Secciones
  $(".cv-section").each((_, sectionEl) => {
    const $section = $(sectionEl);
    const titleText = $section.find("> .cv-section-title").first().text().trim();
    if (titleText) children.push(sectionHeading(titleText));

    // Párrafo de resumen (p.cv-summary u otros <p> sueltos)
    $section.find("> p").each((_, p) => {
      const t = $(p).text().replace(/\s+/g, " ").trim();
      if (t) children.push(plain(t, { after: 100 }));
    });

    // Entradas (experiencia, educación, proyectos)
    $section.find("> .cv-entry").each((_, entryEl) => {
      const $entry = $(entryEl);
      const org = $entry.find("> .cv-entry-header .cv-entry-org").text().trim();
      const loc = $entry.find("> .cv-entry-header .cv-entry-location").text().trim();
      if (org) children.push(entryHeader(org, loc));

      // Puede haber varios .cv-entry-subheader seguidos de su propio .cv-bullets
      // (ej. "Fase 1" / "Fase 2" dentro del mismo cv-entry)
      $entry.children().each((_, node) => {
        const $node = $(node);
        if ($node.hasClass("cv-entry-subheader")) {
          const role = $node.find(".cv-entry-role").text().trim() || $node.text().trim();
          const date = $node.find(".cv-entry-date").text().trim();
          children.push(entrySubheader(role, date));
        } else if ($node.hasClass("cv-bullets") || $node.is("ul")) {
          $node.find("> li").each((_, li) => {
            const t = $(li).text().replace(/\s+/g, " ").trim();
            if (t) children.push(bullet(t));
          });
        }
      });
    });

    // Listas sueltas de sección (ej. Certificaciones, sin .cv-entry envolvente)
    $section.find("> .cv-bullets, > ul.cv-bullets").each((_, ul) => {
      $(ul)
        .find("> li")
        .each((_, li) => {
          const t = $(li).text().replace(/\s+/g, " ").trim();
          if (t) children.push(bullet(t));
        });
    });

    // Skills tipo dl/dt/dd
    $section.find("> .cv-skills .cv-skill-row, > dl.cv-skills > .cv-skill-row").each((_, row) => {
      const label = $(row).find("dt").text().trim();
      const value = $(row).find("dd").text().replace(/\s+/g, " ").trim();
      if (label || value) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: `${label}: `, bold: true, size: 20, font: FONT, color: DARK }),
              new TextRun({ text: value, size: 20, font: FONT, color: DARK }),
            ],
          })
        );
      }
    });
  });

  return { name, children };
}

// ---------- ejecución ----------

function slugify(s) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function main() {
  if (!fs.existsSync(SOURCE_HTML)) {
    console.error(`No encontré ${SOURCE_HTML}. Ajusta SOURCE_HTML si tu index.html está en otra ruta.`);
    process.exit(1);
  }
  const html = fs.readFileSync(SOURCE_HTML, "utf-8");
  const { name, children } = parseCV(html);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // US Letter
            margin: {
              top: convertInchesToTwip(0.6),
              bottom: convertInchesToTwip(0.6),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
            },
          },
        },
        children,
      },
    ],
  });

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
  const outName = `CV_${slugify(name || "candidato")}_ATS.docx`;
  const outPath = path.join(OUTPUT_DIR, outName);

  Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(outPath, buffer);
    console.log(`✔ Generado: ${outPath}`);
  });
}

main();
