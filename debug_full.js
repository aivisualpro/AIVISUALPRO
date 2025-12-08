        // State
        let currentUser = null;
        let clients = [];
        let proposals = [];
        let currentProposalId = null;

        const API_URL = '/webhook/skynetBackend';

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            checkSession();
        });

        async function api(action, payload = {}) {
            try {
                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, payload })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error || 'API Error');
                return data.result;
            } catch (err) {
                console.error(err);
                alert(err.message);
                throw err;
            }
        }

        // Auth
        async function handleLogin() {
            const u = document.getElementById('login-username').value;
            const p = document.getElementById('login-password').value;
            try {
                const res = await api('login', { username: u, password: p });
                loginUser(res.user);
            } catch (e) {
                document.getElementById('login-error').innerText = e.message;
            }
        }

        function loginUser(user) {
            currentUser = user;
            localStorage.setItem('skynet_user', JSON.stringify(user));
            document.getElementById('user-display-name').innerText = currentUser.name;
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            loadData();
        }

        function checkSession() {
            const saved = localStorage.getItem('skynet_user');
            if (saved) {
                try {
                    const user = JSON.parse(saved);
                    loginUser(user);
                } catch (e) {
                    console.error("Invalid session", e);
                }
            }
        }

        function handleLogout() {
            localStorage.removeItem('skynet_user');
            location.reload();
        }

        async function loadData() {
            clients = await api('getClients');
            proposals = await api('getProposals');
            renderClients();
            renderProposals();
            updateDashboard();
        }

        // Navigation
        function showSection(sec) {
            document.querySelectorAll('section').forEach(el => el.classList.add('hidden'));
            document.getElementById(`section-${sec}`).classList.remove('hidden');
            document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
            event.currentTarget.classList.add('active');
        }

        // Dashboard
        function updateDashboard() {
            document.getElementById('dash-total').innerText = proposals.length;
            const pending = proposals.filter(p => !p.status.includes('SIGNED_CLIENT')).length;
            const completed = proposals.filter(p => p.status === 'SIGNED_CLIENT').length;
            document.getElementById('dash-pending').innerText = pending;
            document.getElementById('dash-completed').innerText = completed;
        }

        // Clients
        function renderClients() {
            const tbody = document.getElementById('clients-tbody');
            tbody.innerHTML = clients.map(c => `
                <tr>
                    <td><strong>${c.company || '-'}</strong></td>
                    <td>${c.name}</td>
                    <td>${c.email}</td>
                    <td>${c.phone || '-'}</td>
                    <td><button class="btn btn-sm btn-outline-light" onclick="editClient('${c._id}')">Edit</button></td>
                </tr>
            `).join('');
        }

        function showAddClientModal() {
            document.getElementById('client-id').value = '';
            document.getElementById('client-name').value = '';
            document.getElementById('client-email').value = '';
            document.getElementById('client-company').value = '';
            document.getElementById('client-phone').value = '';
            document.getElementById('client-address').value = '';
            new bootstrap.Modal(document.getElementById('clientModal')).show();
        }

        function editClient(id) {
            const c = clients.find(cl => cl._id === id);
            if (!c) return;
            document.getElementById('client-id').value = c._id;
            document.getElementById('client-company').value = c.company || '';
            document.getElementById('client-name').value = c.name;
            document.getElementById('client-email').value = c.email;
            document.getElementById('client-phone').value = c.phone || '';
            document.getElementById('client-address').value = c.address || '';
            new bootstrap.Modal(document.getElementById('clientModal')).show();
        }

        async function saveClient() {
            const payload = {
                _id: document.getElementById('client-id').value || undefined,
                name: document.getElementById('client-name').value,
                email: document.getElementById('client-email').value,
                company: document.getElementById('client-company').value,
                phone: document.getElementById('client-phone').value,
                address: document.getElementById('client-address').value
            };
            await api('saveClient', payload);
            bootstrap.Modal.getInstance(document.getElementById('clientModal')).hide();
            await loadData();
        }

        let currentEditId = null;

        // Proposals
        function renderProposals() {
            const tbody = document.getElementById('proposals-tbody');
            tbody.innerHTML = proposals.map(p => {
                const mySig = currentUser.id === 'adeel' ? p.signatures.adeel.signed : p.signatures.sagheer.signed;
                const bothSigned = p.signatures.adeel.signed && p.signatures.sagheer.signed;
                const canSign = !mySig && p.status !== 'SENT' && p.status !== 'SIGNED_CLIENT';

                // Send is visible ONLY if both signed
                const canSend = bothSigned && (p.status === 'READY_TO_SEND' || p.status === 'SENT' || p.status === 'SIGNED_PARTIAL');
                // Note: SIGNED_PARTIAL shouldn't theoretically happen if bothSigned is true (it should be READY_TO_SEND), 
                // but checking the flag is safer as per user request.

                let actionHtml = '';
                // View Button (Always visible)
                actionHtml += `<a href="view.html?id=${p._id}" target="_blank" class="btn btn-sm btn-outline-light me-2">View</a>`;

                if (canSign) {
                    actionHtml += `<button class="btn btn-sm btn-warning me-2" onclick="openSignModal('${p._id}')">Sign</button>`;
                }
                if (canSend && p.status !== 'SIGNED_CLIENT') {
                    actionHtml += `<button class="btn btn-sm btn-info" onclick="sendProposal('${p._id}')">Send to Client</button>`;
                }
                if (p.status === 'SIGNED_CLIENT') {
                    actionHtml += `<span class="text-success ms-2"><i class="bi bi-check-all"></i> Done</span>`;
                }

                return `
                <tr>
                    <td>${p.title}</td>
                    <td>${p.clientName}</td>
                    <td><span class="badge badge-status-${p.status.toLowerCase()}">${p.status}</span></td>
                    <td>${mySig ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-circle text-muted"></i>'}</td>
                    <td>${actionHtml}</td>
                </tr>
            `}).join('');
        }

        function showCreateProposalModal(proposal = null) {
            // Populate clients drop down (if not already done, but usually clients list is loaded)
            const sel = document.getElementById('prop-client-select');
            // Retain selection if editing
            const currentVal = sel.value;
            sel.innerHTML = '<option value="">Select Client...</option>' +
                clients.map(c => `<option value="${c._id}">${c.name} (${c.company || '-'})</option>`).join('');

            // Reset or Populate
            if (proposal) {
                currentEditId = proposal._id;
                document.getElementById('proposalModalLabel').innerText = "Edit Proposal";
                document.getElementById('prop-client-select').value = proposal.clientId;
                document.getElementById('prop-title').value = proposal.title;

                // Populate from formData if available
                if (proposal.formData) {
                    const f = proposal.formData;
                    document.getElementById('prop-overview').value = f.overview || '';
                    document.getElementById('prop-pay1-name').value = f.pay1Name || '';
                    document.getElementById('prop-pay1-items').value = f.pay1Items || '';
                    document.getElementById('prop-pay2-name').value = f.pay2Name || '';
                    document.getElementById('prop-pay2-items').value = f.pay2Items || '';
                    document.getElementById('prop-tech-desc').value = f.techDesc || '';
                    document.getElementById('prop-tech-items').value = f.techItems || '';
                    document.getElementById('prop-del-desc').value = f.delDesc || '';
                    document.getElementById('prop-del-items').value = f.delItems || '';
                    document.getElementById('prop-conc-desc').value = f.concDesc || '';
                    document.getElementById('prop-conc-items').value = f.concItems || '';
                } else {
                    // Fallback for old proposals without formData, or if formData is empty
                    document.getElementById('prop-overview').value = '';
                    document.getElementById('prop-pay1-name').value = '';
                    document.getElementById('prop-pay1-items').value = '';
                    document.getElementById('prop-pay2-name').value = '';
                    document.getElementById('prop-pay2-items').value = '';
                    document.getElementById('prop-tech-desc').value = '';
                    document.getElementById('prop-tech-items').value = '';
                    document.getElementById('prop-del-desc').value = '';
                    document.getElementById('prop-del-items').value = '';
                    document.getElementById('prop-conc-desc').value = '';
                    document.getElementById('prop-conc-items').value = '';
                }

                document.getElementById('prop-content').value = proposal.content;
                document.getElementById('btn-save-prop').innerText = "Update Proposal";
            } else {
                currentEditId = null;
                document.getElementById('proposalModalLabel').innerText = "New Proposal";
                document.getElementById('prop-client-select').value = '';
                document.getElementById('prop-title').value = '';
                document.getElementById('prop-overview').value = 'We are pleased to present a proposal for...';
                // Defaults
                document.getElementById('prop-pay1-name').value = 'Monthly Payment Plan';
                document.getElementById('prop-pay1-items').value = 'Cost: $800 per month\nTimeline: 4 months\nIncludes integrations for:\n- Inspection App\n- CRM\n- QC';
                document.getElementById('prop-pay2-name').value = 'Full Project Price (Upfront)';
                document.getElementById('prop-pay2-items').value = 'Cost: $2,000 (100% upfront)\nTimeline: We will prioritize completing...';
                document.getElementById('prop-tech-desc').value = 'To ensure a robust and scalable application, we will use:';
                document.getElementById('prop-tech-items').value = 'Flutter: For front-end development\nNode.js: For the backend\nMongoDB: For the database';
                document.getElementById('prop-del-desc').value = 'We will provide the following deliverables:';
                document.getElementById('prop-del-items').value = 'Inspection App\nCRM for Lead Generation & Scheduling\nQuality Control (QC)\nPrice Discovery';
                document.getElementById('prop-conc-desc').value = 'We are excited about the opportunity to work with you.';
                document.getElementById('prop-conc-items').value = 'Project Kickoff: Upon agreement...\nRegular Updates: ...\nPost-Launch Support: ...';

                document.getElementById('prop-content').value = '';
                document.getElementById('btn-save-prop').innerText = "Create Proposal";
            }

            if (currentEditId) sel.value = proposal.clientId;

            // Activate first tab
            const triggerEl = document.querySelector('#propTabs a[href="#tab-details"]');
            bootstrap.Tab.getInstance(triggerEl) ? bootstrap.Tab.getInstance(triggerEl).show() : new bootstrap.Tab(triggerEl).show();

            new bootstrap.Modal(document.getElementById('proposalModal')).show();
        }

        function generatePreview() {
            // Helper to make lists
            const makeList = (txt) => {
                if (!txt.trim()) return '';
                const items = txt.split('\n').filter(x => x.trim());
                if (items.length === 0) return '';
                return `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
            };

            const overview = document.getElementById('prop-overview').value;

            // Payment
            const pay1Name = document.getElementById('prop-pay1-name').value;
            const pay1Items = document.getElementById('prop-pay1-items').value;
            const pay2Name = document.getElementById('prop-pay2-name').value;
            const pay2Items = document.getElementById('prop-pay2-items').value;

            // Tech 
            const techDesc = document.getElementById('prop-tech-desc').value;
            const techItems = document.getElementById('prop-tech-items').value;

            // Deliverables
            const delDesc = document.getElementById('prop-del-desc').value;
            const delItems = document.getElementById('prop-del-items').value;

            // Conclusion
            const concDesc = document.getElementById('prop-conc-desc').value;
            const concItems = document.getElementById('prop-conc-items').value;

            let html = `
                <h2 style="border-bottom: 2px solid #38bdf8; padding-bottom: 10px; margin-top:20px;">Overview</h2>
                <p>${overview.replace(/\n/g, '<br/>')}</p>

                <h2 style="border-bottom: 2px solid #38bdf8; padding-bottom: 10px; margin-top:30px;">Project Timeline and Payment Options</h2>
                
                <h3 style="color: #0ea5e9; margin-top: 20px;">1. ${pay1Name}</h3>
                ${makeList(pay1Items)}
            `;

            if (pay2Name && pay2Items.trim()) {
                html += `
                    <h3 style="color: #0ea5e9; margin-top: 20px;">2. ${pay2Name}</h3>
                    ${makeList(pay2Items)}
                `;
            }

            html += `
                <h2 style="border-bottom: 2px solid #38bdf8; padding-bottom: 10px; margin-top:30px;">Tech Stack</h2>
                <p>${techDesc}</p>
                ${makeList(techItems)}

                <h2 style="border-bottom: 2px solid #38bdf8; padding-bottom: 10px; margin-top:30px;">Deliverables</h2>
                <p>${delDesc}</p>
                ${makeList(delItems)}

                <h2 style="border-bottom: 2px solid #38bdf8; padding-bottom: 10px; margin-top:30px;">Conclusion</h2>
                <p>${concDesc}</p>
                ${makeList(concItems)}
            `;

            document.getElementById('prop-content').value = html;
        }

        async function editProposal(id) {
            const proposal = proposals.find(p => p._id === id);
            if (!proposal) return;
            showCreateProposalModal(proposal);
        }

        async function saveProposal() {
            // Generate HTML first to ensure it matches
            if (!document.getElementById('prop-content').value.trim()) {
                generatePreview();
            }

            const clientId = document.getElementById('prop-client-select').value;
            const title = document.getElementById('prop-title').value;
            const content = document.getElementById('prop-content').value;

            if (!clientId || !title) return alert("Please select client and title");
            if (!content) return alert("Please generate preview first");

            const client = clients.find(c => c._id === clientId);

            // Gather Form Data
            const formData = {
                overview: document.getElementById('prop-overview').value,
                pay1Name: document.getElementById('prop-pay1-name').value,
                pay1Items: document.getElementById('prop-pay1-items').value,
                pay2Name: document.getElementById('prop-pay2-name').value,
                pay2Items: document.getElementById('prop-pay2-items').value,
                techDesc: document.getElementById('prop-tech-desc').value,
                techItems: document.getElementById('prop-tech-items').value,
                delDesc: document.getElementById('prop-del-desc').value,
                delItems: document.getElementById('prop-del-items').value,
                concDesc: document.getElementById('prop-conc-desc').value,
                concItems: document.getElementById('prop-conc-items').value
            };

            const payload = {
                _id: currentEditId || undefined,
                clientId,
                clientName: client.name,
                clientEmail: client.email,
                title,
                content,
                formData // Save raw data
            };

            await api('saveProposal', payload);
            bootstrap.Modal.getInstance(document.getElementById('proposalModal')).hide();
            await loadData();
        }

        function openSignModal(id) {
            currentProposalId = id;
            document.getElementById('sig-signer-name').innerText = currentUser.name;
            document.getElementById('sig-text').value = '';
            document.getElementById('sig-confirm').checked = false;
            new bootstrap.Modal(document.getElementById('signatureModal')).show();
        }

        async function submitSignature() {
            if (!document.getElementById('sig-confirm').checked) return alert("Please confirm.");
            const sigData = document.getElementById('sig-text').value; // Simple text signature
            if (!sigData) return alert("Please type your name.");

            await api('signProposalInternal', {
                proposalId: currentProposalId,
                signerId: currentUser.id,
                signatureData: sigData
            });
            bootstrap.Modal.getInstance(document.getElementById('signatureModal')).hide();
            await loadData();
        }

        async function sendProposal(id) {
            if (!confirm("Are you sure you want to send this proposal to the client?")) return;
            // UPDATE: Check correct path
            const clientLink = window.location.href.replace('skynetSilicon.html', 'dashboard.html').replace('dashboard.html', 'view.html');
            await api('sendProposalToClient', {
                proposalId: id,
                clientLink: clientLink
            });
            await loadData();
            alert("Proposal sent successfully!");
        }

