/**
 * Evernote Module - Handles Evernote (.enex) import and export functionality
 */

// Evernote Import/Export Manager
class EvernoteManager {
    constructor() {
        this.importModal = null;
        this.importStatus = null;
        this.importProgressBar = null;
        this.fileInput = null;
        
        // Callbacks to be set by main app
        this.onImportComplete = null;
        this.getState = null;
        this.setState = null;
        this.getDefaultInkColor = null;
        this.renderNotebooks = null;
        this.renderHomePage = null;
    }

    // Initialize the module
    init() {
        this.importModal = document.getElementById('import-modal');
        this.importStatus = document.getElementById('import-status');
        this.importProgressBar = document.getElementById('import-progress-bar');
        this.fileInput = document.getElementById('evernote-import');
        
        // Set up file input handler if not already set
        if (this.fileInput && !this.fileInput.hasAttribute('data-evernote-init')) {
            this.fileInput.setAttribute('data-evernote-init', 'true');
        }
    }

    // Trigger import file dialog
    triggerImport() {
        if (this.fileInput) {
            this.fileInput.click();
        } else {
            console.error('Evernote import file input not found');
        }
    }

    // Handle file selection for import
    handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Show import modal
        if (this.importModal) {
            this.importModal.classList.add('active');
        }
        
        if (this.importStatus) {
            this.importStatus.textContent = 'Reading file...';
        }
        
        if (this.importProgressBar) {
            this.importProgressBar.style.width = '10%';
        }

        const reader = new FileReader();
        reader.onload = (e) => this._processImportedFile(e, file);
        reader.onerror = () => this._handleImportError('Error reading file.');
        reader.readAsText(file);
        
        // Reset input for next use
        event.target.value = '';
    }

    // Process the imported ENEX file
    _processImportedFile(e, file) {
        try {
            this._updateProgress('Parsing Evernote notes...', 30);
            
            const parser = new DOMParser();
            const xml = parser.parseFromString(e.target.result, 'text/xml');
            const notes = xml.querySelectorAll('note');
            
            if (notes.length === 0) {
                this._updateProgress('No notes found in file.', 100);
                return;
            }

            // Create a new notebook for the import
            const notebookName = file.name.replace('.enex', '') || 'Evernote Import';
            const notebook = {
                id: Date.now().toString(),
                name: notebookName,
                notes: [],
                isOpen: true
            };

            this._updateProgress(`Importing ${notes.length} notes...`, 50);

            let imported = 0;
            notes.forEach((noteEl, index) => {
                const note = this._parseNote(noteEl, index);
                notebook.notes.push(note);
                imported++;
                
                const progress = 50 + (imported / notes.length) * 45;
                this._updateProgress(`Imported ${imported} of ${notes.length} notes...`, progress);
            });

            // Add notebook to state
            const state = this.getState?.();
            if (state) {
                state.notebooks.push(notebook);
                
                // Save to localStorage
                const dataToSave = JSON.stringify(state.notebooks);
                try {
                    localStorage.setItem('ultimateNotesApp', dataToSave);
                    
                    if (this.renderNotebooks) this.renderNotebooks();
                    if (this.renderHomePage) this.renderHomePage();
                    
                    this._updateProgress(`Successfully imported ${imported} notes into "${notebookName}"!`, 100);
                    
                    if (this.onImportComplete) {
                        this.onImportComplete(notebook);
                    }
                } catch (saveErr) {
                    console.error('Save failed:', saveErr);
                    this._updateProgress('Import failed: Storage is full! Clear some old notes first.', 100);
                    state.notebooks.pop();
                }
            }
        } catch (err) {
            console.error('Import error:', err);
            this._updateProgress('Error importing file. Please check it\'s a valid .enex file.', 100);
        }
    }

    // Parse a single note from ENEX
    _parseNote(noteEl, index) {
        const title = noteEl.querySelector('title')?.textContent || `Note ${index + 1}`;
        const contentEl = noteEl.querySelector('content');
        let content = '';
        let extractedMedia = [];
        
        if (contentEl) {
            let rawContent = this._extractContent(contentEl);
            
            // Build resource map - use order-based matching to avoid memory-intensive MD5 computation
            // Large base64 images can cause memory issues when computing hashes
            // Use getElementsByTagName for better XML compatibility than querySelectorAll
            const resourceEls = Array.from(noteEl.getElementsByTagName('resource') || []);
            const resourcesList = [];
            
            console.log(`Note ${index}: Found ${resourceEls.length} resources via getElementsByTagName`);
            
            resourceEls.forEach((res, idx) => {
                // Use getElementsByTagName for better XML compatibility
                const dataEls = res.getElementsByTagName('data');
                const mimeEls = res.getElementsByTagName('mime');
                const dataEl = dataEls.length > 0 ? dataEls[0] : null;
                const mimeEl = mimeEls.length > 0 ? mimeEls[0] : null;

                // Try to get filename from resource-attributes
                const attrEls = res.getElementsByTagName('resource-attributes');
                let fileName = '';
                if (attrEls.length > 0) {
                    const fileNameEls = attrEls[0].getElementsByTagName('file-name');
                    if (fileNameEls.length > 0) {
                        fileName = fileNameEls[0].textContent || '';
                    }
                }

                // Join all text nodes in <data> (in case of splitting)
                let b64 = '';
                if (dataEl) {
                    b64 = Array.from(dataEl.childNodes).map(n => n.textContent).join('');
                    console.log(`Note ${index} Resource ${idx}: raw joined base64 (first 200):`, b64.slice(0, 200));
                    b64 = b64.replace(/\s+/g, '');
                    // Pad base64 to multiple of 4
                    while (b64.length % 4 !== 0) b64 += '=';
                    console.log(`Note ${index} Resource ${idx}: cleaned base64 (first 200):`, b64.slice(0, 200));
                }
                const mime = (mimeEl?.textContent || '').trim() || '';

                console.log(`  Resource ${idx}: mime=${mime}, b64 length=${b64.length}`);

                const resourceData = { b64, mime, fileName, index: idx };
                resourcesList.push(resourceData);
            });

            // Transform media elements - resources are matched by their order in the ENEX file
            const mediaResult = this._transformMediaElements(rawContent, resourcesList, index);
            rawContent = mediaResult.content;
            extractedMedia = mediaResult.extractedMedia;
            
            console.log(`Note ${index}: Extracted ${extractedMedia.length} media items`);

            // Add placeholders for media
            rawContent = rawContent.replace(/<img[^>]*data-import-id=["']([^"']+)["'][^>]*>/gi, '\n[media:$1]\n');

            content = this.parseENML(rawContent);
        }

        const created = noteEl.querySelector('created')?.textContent;
        const createdDate = created ? this.parseEvernoteDate(created) : Date.now();
        
        const defaultColor = this.getDefaultInkColor?.() || '#333333';
        const startX = 1800;
        const startY = 1800;

        const note = {
            id: (Date.now() + index).toString(),
            name: title,
            canvasData: null,
            textBoxes: [],
            mediaEmbeds: [],
            status: 'none',
            children: [],
            versionHistory: [],
            createdAt: createdDate
        };

        // Add title as header
        note.textBoxes.push({
            content: title,
            left: startX + 'px',
            top: startY + 'px',
            width: '',
            height: '',
            fontFamily: 'Inter',
            fontSize: '24px',
            color: defaultColor,
            headerLevel: '1'
        });

        // Add content lines as text boxes
        if (content) {
            const lines = content.split('\n').filter(l => l.trim());
            let yPos = startY + 60;
            
            lines.forEach((line) => {
                if (line.trim()) {
                    note.textBoxes.push({
                        content: line.trim(),
                        left: startX + 'px',
                        top: yPos + 'px',
                        width: '',
                        height: '',
                        fontFamily: 'Inter',
                        fontSize: '16px',
                        color: defaultColor,
                        headerLevel: null
                    });
                    yPos += 36;
                }
            });
        }

        // Add extracted media as embeds
        if (extractedMedia.length > 0) {
            console.log(`Note ${index}: Adding ${extractedMedia.length} items to mediaEmbeds`);
            extractedMedia.forEach((m, mi) => {
                console.log(`  Media ${mi}: type=${m.type}, url length=${m.url.length}`);
                note.mediaEmbeds.push({
                    id: m.id,
                    type: m.type,
                    url: m.url,
                    fileName: m.fileName,
                    left: (startX + 300 + mi * 220) + 'px',
                    top: (startY + 30) + 'px',
                    width: '200px',
                    height: '150px'
                });
            });
        } else {
            console.log(`Note ${index}: No extracted media, trying direct extraction`);
            // Try to extract resources directly
            this._extractResourcesDirectly(noteEl, note, startX, startY);
        }

        // Check if any resource should be the canvas data
        this._assignCanvasData(note);

        return note;
    }

    // Extract content from ENEX content element
    _extractContent(contentEl) {
        let rawContent = '';
        
        try {
            const first = contentEl.firstChild;
            if (first && first.nodeType === 4 && first.nodeValue) {
                // CDATA section
                rawContent = first.nodeValue;
            } else {
                const serializer = new XMLSerializer();
                rawContent = Array.from(contentEl.childNodes).map(n => serializer.serializeToString(n)).join('');
            }
        } catch (xmlErr) {
            console.warn('XML extraction error, falling back to textContent:', xmlErr);
            rawContent = contentEl.textContent || '';
        }

        // Decode HTML entities
        try {
            const ta = document.createElement('textarea');
            ta.innerHTML = rawContent;
            rawContent = ta.value;
        } catch (decodeErr) {
            console.warn('Failed to decode HTML entities:', decodeErr);
        }

        return rawContent;
    }

    // Transform en-media and img elements
    // Uses order-based matching to avoid memory-intensive hash computation
    _transformMediaElements(rawContent, resourcesList, noteIndex) {
        const extractedMedia = [];
        
        try {
            // Use regex to find en-media tags since DOMParser may not handle custom XML tags well
            const enMediaRegex = /<en-media[^>]*\/?>/gi;
            const enMediaMatches = rawContent.match(enMediaRegex) || [];
            
            console.log(`Note ${noteIndex}: Found ${enMediaMatches.length} en-media tags in content`);
            console.log(`Note ${noteIndex}: Have ${resourcesList.length} resources available`);
            
            let mediaIndex = 0;
            rawContent = rawContent.replace(enMediaRegex, (match) => {
                console.log(`Note ${noteIndex}: Processing en-media tag ${mediaIndex}: ${match.substring(0, 100)}...`);
                
                const res = resourcesList[mediaIndex];
                
                if (res && res.b64) {
                    const url = `data:${res.mime};base64,${res.b64}`;
                    const importId = `import-${noteIndex}-${mediaIndex}`;
                    
                    const type = res.mime.startsWith('image/') ? 'image' : 
                                 res.mime.startsWith('video/') ? 'video' : 
                                 res.mime.startsWith('audio/') ? 'audio' : 'file';
                    
                    extractedMedia.push({ 
                        id: importId, 
                        type, 
                        url, 
                        fileName: res.fileName 
                    });
                    
                    console.log(`Note ${noteIndex}: Matched resource ${mediaIndex} with mime ${res.mime}`);
                    mediaIndex++;
                    return `<img src="${url}" data-import-id="${importId}" />`;
                } else {
                    console.log(`Note ${noteIndex}: No resource available for media tag ${mediaIndex}`);
                }
                
                mediaIndex++;
                return ''; // Remove unmatched en-media tags
            });
            
        } catch (transformErr) {
            console.warn('ENML media transform failed:', transformErr);
        }

        return { content: rawContent, extractedMedia };
    }

    // Extract resources directly from note element
    _extractResourcesDirectly(noteEl, note, startX, startY) {
        try {
            const resources = noteEl.querySelectorAll('resource');
            resources.forEach((res, rIndex) => {
                const dataEl = res.querySelector('data');
                const mimeEl = res.querySelector('mime');
                if (dataEl && mimeEl) {
                    const b64 = (dataEl.textContent || '').replace(/\s+/g, '');
                    const mime = (mimeEl.textContent || '').trim();
                    if (b64) {
                        const url = `data:${mime};base64,${b64}`;
                        const type = mime.startsWith('image/') ? 'image' : 
                                     mime.startsWith('video/') ? 'video' : 
                                     mime.startsWith('audio/') ? 'audio' : 'file';
                        
                        note.mediaEmbeds.push({
                            id: `import-${note.id}-${rIndex}`,
                            type: type,
                            url: url,
                            fileName: res.querySelector('resource-attributes > file-name')?.textContent || '',
                            left: (startX + 300 + rIndex * 220) + 'px',
                            top: (startY + 30) + 'px',
                            width: '200px',
                            height: '150px'
                        });
                    }
                }
            });
        } catch (resErr) {
            console.warn('Error extracting resources from ENEX note:', resErr);
        }
    }

    // Assign canvas data from media embeds if appropriate
    _assignCanvasData(note) {
        try {
            if ((!note.canvasData || note.canvasData === null) && note.mediaEmbeds && note.mediaEmbeds.length) {
                let candidateIdx = note.mediaEmbeds.findIndex(m => 
                    m.type === 'image' && /draw|sketch|canvas|drawing/i.test(m.fileName || '')
                );
                
                if (candidateIdx === -1) {
                    const imageCount = note.mediaEmbeds.filter(m => m.type === 'image').length;
                    if (imageCount === 1) {
                        candidateIdx = note.mediaEmbeds.findIndex(m => m.type === 'image');
                    }
                }
                
                if (candidateIdx !== -1) {
                    const c = note.mediaEmbeds[candidateIdx];
                    note.canvasData = c.url;
                    note.mediaEmbeds.splice(candidateIdx, 1);
                }
            }
        } catch (canvasErr) {
            console.warn('Error assigning canvasData from resources:', canvasErr);
        }
    }

    // Parse ENML to plain text
    parseENML(enml) {
        if (!enml || typeof enml !== 'string') {
            return '';
        }
        
        try {
            let content = enml.trim();
            
            if (content.includes('<')) {
                content = content.replace(/<\?xml[^>]*\?>/gi, '');
                content = content.replace(/<!DOCTYPE[^>]*>/gi, '');
                content = content.replace(/<\/?en-note[^>]*>/gi, '');
                
                content = content.replace(/<br\s*\/?>/gi, '\n');
                content = content.replace(/<\/div>/gi, '\n');
                content = content.replace(/<\/p>/gi, '\n\n');
                content = content.replace(/<\/li>/gi, '\n');
                content = content.replace(/<\/h[1-6]>/gi, '\n\n');
                content = content.replace(/<\/tr>/gi, '\n');
                
                content = content.replace(/<[^>]+>/g, '');
                
                const textarea = document.createElement('textarea');
                textarea.innerHTML = content;
                content = textarea.value;
            }
            
            content = content.replace(/\r\n/g, '\n');
            content = content.replace(/[ \t]+/g, ' ');
            content = content.replace(/\n /g, '\n');
            content = content.replace(/ \n/g, '\n');
            content = content.replace(/\n{3,}/g, '\n\n');
            
            return content.trim();
        } catch (e) {
            console.error('ENML parse error:', e);
            return enml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    // Parse Evernote date format
    parseEvernoteDate(dateStr) {
        try {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const hour = dateStr.substring(9, 11);
            const min = dateStr.substring(11, 13);
            const sec = dateStr.substring(13, 15);
            return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).getTime();
        } catch (e) {
            return Date.now();
        }
    }

    // Update progress display
    _updateProgress(message, percent) {
        if (this.importStatus) {
            this.importStatus.textContent = message;
        }
        if (this.importProgressBar) {
            this.importProgressBar.style.width = percent + '%';
        }
    }

    // Handle import error
    _handleImportError(message) {
        if (this.importStatus) {
            this.importStatus.textContent = message;
        }
        if (this.importProgressBar) {
            this.importProgressBar.style.width = '100%';
        }
    }

    // Close import modal
    closeModal() {
        if (this.importModal) {
            this.importModal.classList.remove('active');
        }
    }

    // Export notes to ENEX format
    async exportToENEX() {
        try {
            const state = this.getState?.();
            if (!state) {
                throw new Error('State not available');
            }
            
            const enex = await this._buildENEX(state);
            const blob = new Blob([enex], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            const now = new Date();
            const filename = `ultimateNotes-export-${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}.enex`;
            link.download = filename;
            
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export to ENEX failed:', e);
            alert('Export failed. See console for details.');
        }
    }

    // Build ENEX XML content
    async _buildENEX(state) {
        const exportDate = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        let enex = '<?xml version="1.0" encoding="UTF-8"?>\n';
        enex += '<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export2.dtd">\n';
        enex += `<en-export export-date="${exportDate}" application="UltimateNotesApp" version="1.0">\n`;

        const notebooks = state.notebooks || [];
        for (const nb of notebooks) {
            for (const note of nb.notes || []) {
                enex += this._buildNoteXML(note);
            }
        }

        enex += '</en-export>\n';
        return enex;
    }

    // Build XML for a single note
    _buildNoteXML(note) {
        const resources = [];
        let noteHtml = '<en-note>';

        const textBoxes = note.textBoxes || [];
        for (let tb of textBoxes) {
            let t = this._escapeHTML(tb.content || '');
            
            // Handle media placeholders
            t = t.replace(/\[media:([^\]]+)\]/g, (_, mid) => {
                const m = (note.mediaEmbeds || []).find(x => x.id === mid);
                if (m) {
                    if (m.url && m.url.startsWith('data:')) {
                        const parts = m.url.split(',');
                        const meta = parts[0];
                        const b64 = parts[1] || '';
                        const mime = (meta.split(':')[1] || '').split(';')[0];
                        const bin = this._b64ToBinaryString(b64);
                        const hash = this._md5(bin);
                        resources.push({ mime, data: b64, hash, fileName: m.fileName || 'resource' });
                        return `<en-media type="${mime}" hash="${hash}"/>`;
                    } else if (m.url) {
                        return `<a href="${this._escapeHTML(m.url)}">${this._escapeHTML(m.url)}</a>`;
                    }
                }
                return '';
            });
            
            noteHtml += `<div>${t}</div>`;
        }

        noteHtml += '</en-note>';

        let xml = '  <note>\n';
        xml += `    <title>${this._escapeHTML(note.name || 'Untitled')}</title>\n`;
        xml += '    <content><![CDATA[' + noteHtml + ']]></content>\n';

        for (const r of resources) {
            xml += '    <resource>\n';
            xml += `      <data encoding="base64">${r.data}</data>\n`;
            xml += `      <mime>${r.mime}</mime>\n`;
            xml += '      <resource-attributes>\n';
            xml += `        <file-name>${this._escapeHTML(r.fileName || 'resource')}</file-name>\n`;
            xml += '      </resource-attributes>\n';
            xml += '    </resource>\n';
        }

        xml += '  </note>\n';
        return xml;
    }

    // Escape HTML entities
    _escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Decode base64 to binary string
    _b64ToBinaryString(b64) {
        try {
            return atob(b64);
        } catch (e) {
            return decodeURIComponent(escape(window.atob(b64)));
        }
    }

    // Simple MD5 implementation for resource hashing
    _md5(s) {
        function md5cycle(x, k) {
            var a = x[0], b = x[1], c = x[2], d = x[3];
            a = ff(a, b, c, d, k[0], 7, -680876936);
            d = ff(d, a, b, c, k[1], 12, -389564586);
            c = ff(c, d, a, b, k[2], 17, 606105819);
            b = ff(b, c, d, a, k[3], 22, -1044525330);
            a = ff(a, b, c, d, k[4], 7, -176418897);
            d = ff(d, a, b, c, k[5], 12, 1200080426);
            c = ff(c, d, a, b, k[6], 17, -1473231341);
            b = ff(b, c, d, a, k[7], 22, -45705983);
            a = ff(a, b, c, d, k[8], 7, 1770035416);
            d = ff(d, a, b, c, k[9], 12, -1958414417);
            c = ff(c, d, a, b, k[10], 17, -42063);
            b = ff(b, c, d, a, k[11], 22, -1990404162);
            a = ff(a, b, c, d, k[12], 7, 1804603682);
            d = ff(d, a, b, c, k[13], 12, -40341101);
            c = ff(c, d, a, b, k[14], 17, -1502002290);
            b = ff(b, c, d, a, k[15], 22, 1236535329);
            a = gg(a, b, c, d, k[1], 5, -165796510);
            d = gg(d, a, b, c, k[6], 9, -1069501632);
            c = gg(c, d, a, b, k[11], 14, 643717713);
            b = gg(b, c, d, a, k[0], 20, -373897302);
            a = gg(a, b, c, d, k[5], 5, -701558691);
            d = gg(d, a, b, c, k[10], 9, 38016083);
            c = gg(c, d, a, b, k[15], 14, -660478335);
            b = gg(b, c, d, a, k[4], 20, -405537848);
            a = gg(a, b, c, d, k[9], 5, 568446438);
            d = gg(d, a, b, c, k[14], 9, -1019803690);
            c = gg(c, d, a, b, k[3], 14, -187363961);
            b = gg(b, c, d, a, k[8], 20, 1163531501);
            a = gg(a, b, c, d, k[13], 5, -1444681467);
            d = gg(d, a, b, c, k[2], 9, -51403784);
            c = gg(c, d, a, b, k[7], 14, 1735328473);
            b = gg(b, c, d, a, k[12], 20, -1926607734);
            a = hh(a, b, c, d, k[5], 4, -378558);
            d = hh(d, a, b, c, k[8], 11, -2022574463);
            c = hh(c, d, a, b, k[11], 16, 1839030562);
            b = hh(b, c, d, a, k[14], 23, -35309556);
            a = hh(a, b, c, d, k[1], 4, -1530992060);
            d = hh(d, a, b, c, k[4], 11, 1272893353);
            c = hh(c, d, a, b, k[7], 16, -155497632);
            b = hh(b, c, d, a, k[10], 23, -1094730640);
            a = hh(a, b, c, d, k[13], 4, 681279174);
            d = hh(d, a, b, c, k[0], 11, -358537222);
            c = hh(c, d, a, b, k[3], 16, -722521979);
            b = hh(b, c, d, a, k[6], 23, 76029189);
            a = hh(a, b, c, d, k[9], 4, -640364487);
            d = hh(d, a, b, c, k[12], 11, -421815835);
            c = hh(c, d, a, b, k[15], 16, 530742520);
            b = hh(b, c, d, a, k[2], 23, -995338651);
            a = ii(a, b, c, d, k[0], 6, -198630844);
            d = ii(d, a, b, c, k[7], 10, 1126891415);
            c = ii(c, d, a, b, k[14], 15, -1416354905);
            b = ii(b, c, d, a, k[5], 21, -57434055);
            a = ii(a, b, c, d, k[12], 6, 1700485571);
            d = ii(d, a, b, c, k[3], 10, -1894986606);
            c = ii(c, d, a, b, k[10], 15, -1051523);
            b = ii(b, c, d, a, k[1], 21, -2054922799);
            a = ii(a, b, c, d, k[8], 6, 1873313359);
            d = ii(d, a, b, c, k[15], 10, -30611744);
            c = ii(c, d, a, b, k[6], 15, -1560198380);
            b = ii(b, c, d, a, k[13], 21, 1309151649);
            a = ii(a, b, c, d, k[4], 6, -145523070);
            d = ii(d, a, b, c, k[11], 10, -1120210379);
            c = ii(c, d, a, b, k[2], 15, 718787259);
            b = ii(b, c, d, a, k[9], 21, -343485551);
            x[0] = add32(a, x[0]);
            x[1] = add32(b, x[1]);
            x[2] = add32(c, x[2]);
            x[3] = add32(d, x[3]);
        }
        
        function cmn(q, a, b, x, s, t) {
            a = add32(add32(a, q), add32(x, t));
            return add32((a << s) | (a >>> (32 - s)), b);
        }
        
        function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
        function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
        function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
        function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
        
        function md51(s) {
            var n = s.length,
                state = [1732584193, -271733879, -1732584194, 271733878],
                i;
            for (i = 64; i <= s.length; i += 64) {
                md5cycle(state, md5blk(s.substring(i - 64, i)));
            }
            s = s.substring(i - 64);
            var tail = new Array(16).fill(0);
            for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
            tail[i >> 2] |= 0x80 << ((i % 4) << 3);
            if (i > 55) {
                md5cycle(state, tail);
                tail = new Array(16).fill(0);
            }
            tail[14] = n * 8;
            md5cycle(state, tail);
            return state;
        }
        
        function md5blk(s) {
            var md5blks = [], i;
            for (i = 0; i < 64; i += 4) {
                md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + 
                                  (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
            }
            return md5blks;
        }
        
        var hex_chr = '0123456789abcdef'.split('');
        
        function rhex(n) {
            var s = '', j = 0;
            for (; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
            return s;
        }
        
        function hex(x) {
            for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]);
            return x.join('');
        }
        
        function add32(a, b) { return (a + b) & 0xFFFFFFFF; }

        return hex(md51(s));
    }
}

// Create and export module instance
const evernoteModule = new EvernoteManager();

// Make available globally
window.evernoteModule = evernoteModule;
window.EvernoteManager = EvernoteManager;

// Global helper functions for backward compatibility
window.triggerEvernoteImport = function() {
    evernoteModule.triggerImport();
};

window.handleEvernoteImport = function(event) {
    evernoteModule.handleImport(event);
};

window.closeImportModal = function() {
    evernoteModule.closeModal();
};
