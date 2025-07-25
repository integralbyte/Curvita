function hoverState() {
    return {
        isVisible: false,
        timer: null,
        show() {
            clearTimeout(this.timer);
            this.isVisible = true;
        },
        hide() {
            this.timer = setTimeout(() => {
                this.isVisible = false;
            }, 250);
        }
    }
}

function cvApp() {
    return {
        contact: {}, resumeContent: [], theme: 'light',
        showImportModal: false, jsonPasteData: '',

        init() {
            Object.assign(this, this.getInitialData());
            this.loadFromLocalStorage();
            this.initSortable();
            this.$watch('contact', () => this.saveToLocalStorage(), { deep: true });
            this.$watch('resumeContent', () => this.saveToLocalStorage(), { deep: true });
            const savedTheme = localStorage.getItem('cv-theme');
            if (savedTheme) {
                this.theme = savedTheme;
            } else {
                this.theme = 'light';
            }

        },

        get visibleContactInfo() {
            return this.contact.infoItems.filter(item => item.value);
        },

        generateHref(item) {
            if (!item.value) return '#';
            const value = item.value.trim();
            if (value.includes('@')) return `mailto:${value}`;
            if (/^[\d\s()+-]+$/.test(value) && value.length > 6) return `tel:${value}`;
            if (value.startsWith('http')) return value;
            return `https://${value.replace(/https?:\/\//, '')}`;
        },

        initSortable() { Sortable.create(document.getElementById('content-container'), { handle: '.drag-handle', animation: 150, onEnd: (evt) => { const movedItem = this.resumeContent.splice(evt.oldIndex, 1)[0]; this.resumeContent.splice(evt.newIndex, 0, movedItem); } }); },

        editField(event, fieldName, itemId = null, sectionId = null) {
            const el = event.currentTarget;
            let model;
            if (sectionId && !itemId) model = this.resumeContent.find(c => c.id === sectionId);
            else if (itemId && sectionId) model = this.resumeContent.find(c => c.id === sectionId)?.items.find(i => i.id === itemId);
            else if (itemId && !sectionId) model = this.contact.infoItems.find(i => i.id === itemId);
            else model = this.contact;
            if (!model) return;
            const originalText = model[fieldName];
            const isTextarea = fieldName === 'bullets';
            const input = document.createElement(isTextarea ? 'textarea' : 'input');
            input.className = 'inline-edit';
            if (!isTextarea) input.type = 'text';
            input.value = originalText || '';
            el.style.display = 'none';
            el.parentNode.insertBefore(input, el);
            input.focus();
            const autoResize = () => { if (isTextarea) { input.style.height = 'auto'; input.style.height = (input.scrollHeight) + 'px'; } };
            autoResize();
            input.addEventListener('input', autoResize);
            const onFinish = () => { model[fieldName] = input.value; el.style.display = ''; input.remove(); };
            input.addEventListener('blur', onFinish);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !isTextarea && !e.shiftKey) { e.preventDefault(); input.blur(); }
                if (e.key === 'Escape') { input.value = originalText; input.blur(); }
            });
        },

        generateId: () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

        addContent(type, index) {
            let newContent;
            if (type === 'section') {
                newContent = { type: 'section', id: this.generateId(), title: 'New Section', titleColor: null, items: [{ id: this.generateId(), title: '', subtitle: '', date: '', note: '', bullets: '' }] };
            } else if (type === 'pagebreak') {
                newContent = { type: 'pagebreak', id: this.generateId() };
            }
            this.resumeContent.splice(index, 0, newContent);
        },

        removeContent(id) {
            if (confirm('Are you sure you want to delete this block?')) {
                this.resumeContent = this.resumeContent.filter(c => c.id !== id);
            }
        },

        addItem(sectionId) { const section = this.resumeContent.find(s => s.id === sectionId); if (section) section.items.push({ id: this.generateId(), title: '', subtitle: '', date: '', note: '', bullets: '' }); },
        removeItem(sectionId, itemId) { const section = this.resumeContent.find(s => s.id === sectionId); if (section) section.items = section.items.filter(item => item.id !== itemId); },
        formatBullets(text) { return text ? '<ul>' + text.split('\n').filter(b => b.trim() !== '').map(b => `<li>${this.escapeHTML(b.replace(/^•\s*/, ''))}</li>`).join('') + '</ul>' : ''; },
        escapeHTML(str) { const p = document.createElement('p'); p.textContent = str; return p.innerHTML; },
        toggleTheme() { this.theme = this.theme === 'light' ? 'dark' : 'light'; localStorage.setItem('cv-theme', this.theme); },
        saveToLocalStorage() { localStorage.setItem('cv-data', JSON.stringify({ contact: this.contact, resumeContent: this.resumeContent })); },

        addContactInfo() {
            this.contact.infoItems.push({
                id: this.generateId(),
                value: '[new contact info]',
                color: null
            });
        },
        removeContactInfo(id) {
            this.contact.infoItems = this.contact.infoItems.filter(item => item.id !== id);
        },


        loadFromLocalStorage() {
            const savedData = localStorage.getItem('cv-data');
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    
                    if (parsed.contact && parsed.resumeContent) {
                        this.contact = parsed.contact;
                        this.resumeContent = parsed.resumeContent;
                    }
                } catch (e) {
                    console.error("Could not load data from localStorage, it might be corrupted.", e);
                    localStorage.removeItem('cv-data');
                }
            }

            const savedTheme = localStorage.getItem('cv-theme');
            if (savedTheme) {
                this.theme = savedTheme;
            }
        },
        importFromPastedJSON() { this.processImport(this.jsonPasteData); this.showImportModal = false; this.jsonPasteData = ''; },
        importJSONFromFile(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => this.processImport(e.target.result);
            reader.readAsText(file);
            event.target.value = '';
        },
        processImport(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                if (data.sections) {
                    data.resumeContent = data.sections.map(s => ({ ...s, type: 'section' }));
                    delete data.sections;
                }
                if (data.contact && data.resumeContent) {
                    if (confirm("Importing will overwrite your current CV. Continue?")) {
                        this.contact = data.contact; this.resumeContent = data.resumeContent;
                    }
                } else { throw new Error("Missing 'contact' or 'resumeContent' keys."); }
            } catch (e) { alert(`Could not import data. Please check the format.\nError: ${e.message}`); }
        },

        openInOverleaf() {
            const latexString = this.generateLatexString();
            const encodedSnip = encodeURIComponent(latexString);
            const form = document.createElement('form');
            form.method = 'post';
            form.action = 'https://www.overleaf.com/docs';
            form.target = '_blank';
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'encoded_snip';
            input.value = encodedSnip;
            form.appendChild(input);
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        },

        escapeLatex(str) { return str ? str.replace(/[&%$#_{}~^\\]/g, '\\$&') : ''; },
        eColor(text, color) {
            if (!text || !text.trim()) return '';
            const e = this.escapeLatex;
            if (!color || color === '#000000' || color === '#ffffff') return e(text);
            const hex = color.substring(1).toUpperCase();
            return `\\textcolor[HTML]{${hex}}{${e(text)}}`;
        },

        generateLatexString() {
            const contactParts = this.visibleContactInfo.map(info => {
                if (info.key === 'email') return `\\href{mailto:${info.value}}{${this.eColor(info.value, info.color)}}`;
                if (info.key === 'linkedin') return `\\href{https://${info.value.replace(/https?:\/\//, '')}}{${this.eColor(info.value, info.color)}}`;
                return this.eColor(info.value, info.color);
            }).join('~•~');

            let latex = `\\documentclass[a4paper,11pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{geometry}\n\\usepackage[hyphens]{url}\n\\usepackage[svgnames,HTML]{xcolor}\n\\usepackage{titlesec}\n\\usepackage{enumitem}\n\\usepackage{tabularx}\n\\usepackage[hidelinks]{hyperref}\n\n\\geometry{a4paper, top=2.2cm, bottom=2.2cm, left=2.2cm, right=2.2cm}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0pt}\n\\setlist[itemize]{leftmargin=*, noitemsep, topsep=3pt, partopsep=0pt, parsep=0pt}\n\\urlstyle{same}\n\n\\titleformat{\\section}{\\large\\scshape\\raggedright}{}{0em}{}[\\color{DarkGray!80}\\titlerule]\n\\titlespacing*{\\section}{0pt}{12pt}{8pt}\n\n\\begin{document}\n\\begin{center}\n    {\\Huge\\scshape ${this.eColor(this.contact.name, this.contact.nameColor)}}\n    \\vspace{8pt}\n    \n    \\noindent\n    ${contactParts}\n\\end{center}\n\n`;

            this.resumeContent.forEach(content => {
                if (content.type === 'pagebreak') {
                    latex += '\\newpage\n';
                    return;
                }

                const sec = content;
                if (!sec.title && sec.items.every(i => !i.title && !i.subtitle)) return;
                latex += `\\section*{${this.eColor(sec.title, sec.titleColor)}}\n`;
                sec.items.forEach(item => {
                    if (!item.title && !item.subtitle && !item.date && !item.note) return;
                    latex += `\\vspace{-5pt}\\begin{tabularx}{\\textwidth}{@{}l X r@{}}\n`;
                    latex += `    \\textbf{\\large ${this.eColor(item.title, item.titleColor)}} & & \\textit{${this.escapeLatex(item.date)}} \\\\\n`;
                    if (item.subtitle || item.note) {
                        latex += `    \\textit{${this.eColor(item.subtitle, item.subtitleColor)}} & & \\textit{${this.escapeLatex(item.note)}} \\\\\n`;
                    }
                    latex += `\\end{tabularx}\n`;
                    if (item.bullets && item.bullets.trim()) {
                        const bullets = item.bullets.split('\n').filter(b => b.trim()).map(b => `    \\item ${this.escapeLatex(b.replace(/^•\\s*/, ''))}`).join('\n');
                        latex += `\\begin{itemize}\n${bullets}\n\\end{itemize}\n`;
                    }
                    latex += `\\par\\vspace{14pt}\n`;
                });
            });
            latex += `\\end{document}`;
            return latex;
        },

        exportLaTeX() {
            const latexString = this.generateLatexString();
            const blob = new Blob([latexString], { type: 'text/x-latex' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `${(this.contact.name || 'CV').replace(/\s/g, '_')}.tex`; a.click(); URL.revokeObjectURL(a.href);
        },

        exportJSON() {
            const data = JSON.stringify({ contact: this.contact, resumeContent: this.resumeContent }, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = 'cv_data.json'; a.click(); URL.revokeObjectURL(a.href);
        },

        clearResume() {
            if (confirm('Are you sure you want to clear the entire resume? This action cannot be undone.')) {
                this.contact = {
                    name: "",
                    nameColor: null,
                    infoItems: []
                };
                this.resumeContent = [
                    {
                        type: 'section',
                        id: this.generateId(),
                        title: 'New Section',
                        titleColor: null,
                        items: [
                            {
                                id: this.generateId(),
                                title: '',
                                subtitle: '',
                                date: '',
                                note: '',
                                bullets: ''
                            }
                        ]
                    }
                ];
            }
        },

        getInitialData() {
            return {
                "contact": {
                    "name": "Alexander R. Smith",
                    "nameColor": "#1a73e8",
                    "infoItems": [
                        { "id": "contact_1", "value": "alex.smith@example.com", "color": "#333333" },
                        { "id": "contact_2", "value": "+1 (555) 123-4567", "color": "#333333" },
                        { "id": "contact_3", "value": "linkedin.com/in/alexrsmith", "color": "#0077b5" }
                    ]
                },
                "resumeContent": [
                    {
                        "type": "section",
                        "id": "sec_education",
                        "title": "Education",
                        "titleColor": "#1a1a1a",
                        "items": [
                            {
                                "id": "edu1",
                                "title": "MSc in Computer Science",
                                "titleColor": "#000000",
                                "subtitle": "Stanford University",
                                "subtitleColor": "#666666",
                                "date": "Sep 2019 – Jun 2021",
                                "note": "GPA: 4.0/4.0",
                                "bullets": "Specialized in Machine Learning and Systems.\nThesis: \"Optimizing Large-Scale Distributed Training of Deep Neural Networks\"."
                            },
                            {
                                "id": "edu2",
                                "title": "BSc in Computer Engineering",
                                "titleColor": "#000000",
                                "subtitle": "University of Illinois Urbana-Champaign",
                                "subtitleColor": "#666666",
                                "date": "Sep 2015 – Jun 2019",
                                "note": "Magna Cum Laude",
                                "bullets": "Dean’s List (2016–2019).\nUndergraduate Research: FPGA acceleration for convolutional neural networks."
                            }
                        ]
                    },
                    {
                        "type": "section",
                        "id": "sec_experience",
                        "title": "Professional Experience",
                        "titleColor": "#1a1a1a",
                        "items": [
                            {
                                "id": "exp1",
                                "title": "Senior Software Engineer",
                                "titleColor": "#0d47a1",
                                "subtitle": "Google LLC",
                                "subtitleColor": "#555555",
                                "date": "Jul 2021 – Present",
                                "note": "Mountain View, CA",
                                "bullets": "Led development of privacy-preserving ML infrastructure using federated learning techniques.\nCollaborated with cross-functional teams to deploy production ML models to Google Search.\nMentored 3 junior engineers and interns."
                            },
                            {
                                "id": "exp2",
                                "title": "Software Engineering Intern",
                                "titleColor": "#0d47a1",
                                "subtitle": "Amazon Web Services",
                                "subtitleColor": "#555555",
                                "date": "Jun 2020 – Sep 2020",
                                "note": "Seattle, WA",
                                "bullets": "Implemented scalable REST APIs in Java and Spring Boot for internal developer tools.\nImproved data pipeline performance by 30% via Spark job optimizations."
                            }
                        ]
                    },
                    {
                        "type": "section",
                        "id": "sec_projects",
                        "title": "Projects",
                        "titleColor": "#1a1a1a",
                        "items": [
                            {
                                "id": "proj1",
                                "title": "AI Resume Builder",
                                "subtitle": "Open Source Project",
                                "date": "Actively maintained",
                                "note": "GitHub: github.com/alexrsmith/ai-cv-builder",
                                "bullets": "Built a real-time CV generator using Vue.js and Firebase.\nIntegrated GPT-based autofill for resume fields."
                            },
                            {
                                "id": "proj2",
                                "title": "Voice-Controlled Smart Mirror",
                                "subtitle": "Personal Project",
                                "date": "Built with Raspberry Pi and Python",
                                "note": "",
                                "bullets": "Integrated voice recognition with facial detection.\nDisplayed weather, calendar, and news using custom APIs."
                            }
                        ]
                    },
                    {
                        "type": "section",
                        "id": "sec_certifications",
                        "title": "Certifications",
                        "titleColor": "#1a1a1a",
                        "items": [
                            {
                                "id": "cert1",
                                "title": "AWS Certified Solutions Architect – Associate",
                                "subtitle": "Amazon Web Services",
                                "date": "Issued Oct 2023",
                                "note": "",
                                "bullets": ""
                            },
                            {
                                "id": "cert2",
                                "title": "Deep Learning Specialization",
                                "subtitle": "Coursera (Andrew Ng)",
                                "date": "Completed on Coursera",
                                "note": "",
                                "bullets": "Neural networks, CNNs, RNNs, and sequence models.\nCapstone project using TensorFlow."
                            }
                        ]
                    },
                    {
                        "type": "section",
                        "id": "sec_volunteer",
                        "title": "Volunteer Work",
                        "titleColor": "#1a1a1a",
                        "items": [
                            {
                                "id": "vol1",
                                "title": "Technical Mentor",
                                "subtitle": "Code2040",
                                "date": "Dates not specified",
                                "note": "",
                                "bullets": "Mentored underrepresented students in tech, guiding them through project development and interview prep."
                            },
                            {
                                "id": "vol2",
                                "title": "Workshop Speaker",
                                "subtitle": "Local Hack Day",
                                "date": "Provided advanced React.js training",
                                "note": "",
                                "bullets": ""
                            }
                        ]
                    }
                ]

            };
        }
    }
}

window.cvApp = cvApp;
window.hoverState = hoverState;
