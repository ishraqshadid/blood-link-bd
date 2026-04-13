const SUPABASE_URL = 'https://ahcoliliwwwovdfdpjew.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Szjwx8FpUT2-e-viMDIY6w_sWrXSHK7';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BloodLinkAdmin = {
  session: null,
  adminRow: null,
  async init() {
    const page = window.BLOODLINK_ADMIN_PAGE;
    if (page === 'login') return this.initLogin();
    return this.initPanel();
  },

  async initLogin() {
    const status = document.getElementById('status');
    document.getElementById('google-btn').onclick = async () => {
      status.textContent = 'Redirecting...';
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/admin-panel.html', queryParams: { prompt: 'select_account' } }
      });
      if (error) status.textContent = error.message;
    };

    document.getElementById('magic-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      if (!email) return;
      status.textContent = 'Sending magic link...';
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + '/admin-panel.html' }
      });
      status.textContent = error ? error.message : 'Magic link sent. Check your inbox.';
    });

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) window.location.href = 'admin-panel.html';
  },

  async initPanel() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      window.location.href = 'admin-login.html';
      return;
    }
    this.session = session;
    await this.ensureAdmin();
    this.bindNav();
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
    document.getElementById('mobile-logout-btn')?.addEventListener('click', () => this.logout());
    document.getElementById('donor-search')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.loadDonors(); });

    if (!this.adminRow) return;
    document.getElementById('admin-meta').innerHTML = `<div class="font-bold text-white">${this.adminRow.email || session.user.email || 'Admin'}</div><div class="text-xs text-slate-500 mt-1">Role: ${this.adminRow.role || 'super_admin'}</div>`;
    await this.loadOverview();
    await Promise.all([this.loadDonors(), this.loadRequests(), this.loadVerifications(), this.loadLeaderboard(), this.loadSettings()]);
  },

  async ensureAdmin() {
    const unauthorized = document.getElementById('unauthorized');
    const { data, error } = await supabaseClient.from('admins').select('*').eq('user_id', this.session.user.id).eq('is_active', true).maybeSingle();
    if (error || !data) {
      unauthorized?.classList.remove('hidden');
      return;
    }
    this.adminRow = data;
    unauthorized?.classList.add('hidden');
  },

  bindNav() {
    const show = (section) => {
      document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
      document.getElementById(`section-${section}`)?.classList.remove('hidden');
      document.querySelectorAll('.nav-btn, .mobile-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.section === section));
    };
    document.querySelectorAll('.nav-btn, .mobile-tab').forEach(btn => btn.addEventListener('click', () => show(btn.dataset.section)));
  },

  toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
  },

  fmtDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    return d.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  },

  badge(text, kind='slate') {
    return `<span class="badge ${kind}">${text}</span>`;
  },

  async audit(action, target_type='system', target_id=null, details={}) {
    try {
      await supabaseClient.from('audit_logs').insert([{ admin_user_id: this.session.user.id, action, target_type, target_id, details }]);
    } catch (_) {}
  },

  async loadOverview() {
    const exactCount = async (table, filterFn) => {
      let query = supabaseClient.from(table).select('*', { count: 'exact', head: true });
      if (filterFn) query = filterFn(query);
      const { count } = await query;
      return count ?? 0;
    };
    document.getElementById('stat-donors').textContent = await exactCount('donors');
    document.getElementById('stat-available').textContent = await exactCount('donors', q => q.eq('is_available', true));
    document.getElementById('stat-open-requests').textContent = await exactCount('blood_requests', q => q.eq('status', 'open'));
    document.getElementById('stat-pending').textContent = await exactCount('pending_verifications', q => q.eq('status', 'pending'));
  },

  async loadDonors() {
    if (!this.adminRow) return;
    const keyword = document.getElementById('donor-search')?.value?.trim().toLowerCase() || '';
    const { data, error } = await supabaseClient.from('donors').select('*').order('total_donations', { ascending: false }).limit(200);
    if (error) return this.toast(error.message);
    let rows = data || [];
    if (keyword) {
      rows = rows.filter(d => [d.full_name, d.phone_number, d.district, d.upazila, d.blood_group].filter(Boolean).join(' ').toLowerCase().includes(keyword));
    }
    const body = document.getElementById('donors-body');
    body.innerHTML = rows.map(d => {
      const status = d.is_available ? this.badge('Available', 'green') : this.badge('Unavailable', 'red');
      const cooldown = d.availability_locked ? `<div class="text-xs text-amber-300 font-bold">Locked</div><div class="text-xs text-slate-400">${this.fmtDate(d.cooldown_until)}</div>` : '<span class="text-slate-500">—</span>';
      return `<tr>
        <td><div class="font-bold">${d.full_name || 'Unnamed'}</div><div class="text-xs text-slate-500">${d.phone_number || ''}</div></td>
        <td>${d.blood_group || '—'}</td>
        <td>${[d.upazila, d.district].filter(Boolean).join(', ') || '—'}</td>
        <td>${status}<div class="text-xs text-slate-500 mt-1">${d.total_donations || 0} donations</div></td>
        <td>${cooldown}</td>
        <td><div class="action-row">
          <button class="secondary" onclick="BloodLinkAdmin.toggleAvailability('${d.user_id}', ${!!d.is_available})">${d.is_available ? 'Turn Off' : 'Turn On'}</button>
          <button onclick="BloodLinkAdmin.unlockCooldown('${d.user_id}')">Unlock</button>
        </div></td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" class="text-slate-500">No donors found.</td></tr>`;
  },

  async toggleAvailability(userId, currentlyAvailable) {
    const payload = { is_available: !currentlyAvailable };
    const { error } = await supabaseClient.from('donors').update(payload).eq('user_id', userId);
    if (error) return this.toast(error.message);
    await this.audit('toggle_availability', 'donor', userId, payload);
    this.toast('Availability updated');
    await Promise.all([this.loadDonors(), this.loadOverview()]);
  },

  async unlockCooldown(userId) {
    const payload = { is_available: true, availability_locked: false, cooldown_until: null, cooldown_reason: null };
    const { error } = await supabaseClient.from('donors').update(payload).eq('user_id', userId);
    if (error) return this.toast(error.message);
    await this.audit('unlock_cooldown', 'donor', userId, payload);
    this.toast('Cooldown unlocked');
    await Promise.all([this.loadDonors(), this.loadOverview()]);
  },

  async loadRequests() {
    if (!this.adminRow) return;
    const status = document.getElementById('request-filter-status')?.value || '';
    let q = supabaseClient.from('blood_requests').select('*').order('created_at', { ascending: false }).limit(200);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return this.toast(error.message);
    const list = data || [];
    document.getElementById('requests-body').innerHTML = list.map(r => `<tr>
      <td><div class="font-bold">${r.patient_name || '—'}</div><div class="text-xs text-slate-500">${this.fmtDate(r.created_at)}</div></td>
      <td>${r.blood_group || '—'} · ${r.units || 0} bag</td>
      <td>${r.hospital_name || '—'}</td>
      <td>${[r.upazila, r.district].filter(Boolean).join(', ') || '—'}</td>
      <td>${this.badge((r.status || 'open').toUpperCase(), r.status === 'fulfilled' ? 'green' : r.status === 'expired' ? 'amber' : 'slate')}</td>
      <td><div class="action-row">
        <button onclick="BloodLinkAdmin.markRequest('${r.id}', 'fulfilled')">Fulfill</button>
        <button class="secondary" onclick="BloodLinkAdmin.markRequest('${r.id}', 'open')">Reopen</button>
        <button class="secondary" onclick="BloodLinkAdmin.markRequest('${r.id}', 'expired')">Expire</button>
        <button class="secondary" onclick="BloodLinkAdmin.deleteRequest('${r.id}')">Delete</button>
      </div></td>
    </tr>`).join('') || `<tr><td colspan="6" class="text-slate-500">No requests found.</td></tr>`;

    document.getElementById('overview-requests').innerHTML = list.slice(0,5).map(r => `<div class="list-card"><p class="font-bold">${r.patient_name} · ${r.blood_group}</p><small>${r.hospital_name || 'Hospital'} · ${[r.upazila, r.district].filter(Boolean).join(', ') || 'Area not set'} · ${r.status || 'open'}</small></div>`).join('') || '<div class="text-slate-500">No recent requests.</div>';
  },

  async markRequest(id, status) {
    const payload = { status, fulfilled_at: status === 'fulfilled' ? new Date().toISOString() : null };
    const { error } = await supabaseClient.from('blood_requests').update(payload).eq('id', id);
    if (error) return this.toast(error.message);
    await this.audit('mark_request_status', 'request', id, payload);
    this.toast(`Request marked ${status}`);
    await Promise.all([this.loadRequests(), this.loadOverview()]);
  },

  async deleteRequest(id) {
    if (!confirm('Delete this request?')) return;
    const { error } = await supabaseClient.from('blood_requests').delete().eq('id', id);
    if (error) return this.toast(error.message);
    await this.audit('delete_request', 'request', id);
    this.toast('Request deleted');
    await Promise.all([this.loadRequests(), this.loadOverview()]);
  },

  async loadVerifications() {
    if (!this.adminRow) return;
    const { data, error } = await supabaseClient.from('pending_verifications').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return this.toast(error.message);
    const rows = data || [];
    const body = document.getElementById('verifications-body');
    body.innerHTML = rows.map(v => `<tr>
      <td>${v.donor_name || v.donor_id || '—'}</td>
      <td>${v.requester_name || v.requester_id || '—'}</td>
      <td>${this.badge((v.status || 'pending').toUpperCase(), v.status === 'verified' ? 'green' : v.status === 'rejected' ? 'red' : 'amber')}</td>
      <td>${this.fmtDate(v.created_at)}</td>
      <td><div class="action-row">
        <button onclick="BloodLinkAdmin.approveVerification(${v.id})">Approve</button>
        <button class="secondary" onclick="BloodLinkAdmin.rejectVerification(${v.id})">Reject</button>
        <button class="secondary" onclick="BloodLinkAdmin.deleteVerification(${v.id})">Delete</button>
      </div></td>
    </tr>`).join('') || `<tr><td colspan="5" class="text-slate-500">No verification items.</td></tr>`;
    document.getElementById('overview-verifications').innerHTML = rows.slice(0,5).map(v => `<div class="list-card"><p class="font-bold">${v.donor_name || 'Donor'} → ${v.requester_name || 'Requester'}</p><small>${v.status || 'pending'} · ${this.fmtDate(v.created_at)}</small></div>`).join('') || '<div class="text-slate-500">No recent verifications.</div>';
  },

  async approveVerification(id) {
    const { data: pv, error: pvErr } = await supabaseClient.from('pending_verifications').select('*').eq('id', id).single();
    if (pvErr || !pv) return this.toast(pvErr?.message || 'Verification not found');
    if (pv.status === 'verified') return this.toast('Already verified');

    const { data: donor, error: donorErr } = await supabaseClient.from('donors').select('*').eq('user_id', pv.donor_id).single();
    if (donorErr || !donor) return this.toast(donorErr?.message || 'Donor not found');

    const { data: existingEvent } = await supabaseClient.from('donation_events').select('id').eq('pending_verification_id', id).maybeSingle();
    if (!existingEvent) {
      const points = 100;
      const eventPayload = {
        pending_verification_id: id,
        donor_id: pv.donor_id,
        requester_id: pv.requester_id,
        request_id: pv.request_id || null,
        source: pv.source || 'admin',
        points,
        blood_group: donor.blood_group || null,
        district: donor.district || null,
        upazila: donor.upazila || null
      };
      const { error: eErr } = await supabaseClient.from('donation_events').insert([eventPayload]);
      if (eErr) return this.toast(eErr.message);

      const cooldownDays = Number(document.getElementById('setting-cooldown-days')?.value || 90);
      const cooldownUntil = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toISOString();
      const donorPayload = {
        total_donations: (donor.total_donations || 0) + 1,
        last_donation_date: new Date().toISOString().split('T')[0],
        is_available: false,
        availability_locked: true,
        cooldown_until: cooldownUntil,
        cooldown_reason: 'Donation verified by admin.'
      };
      const { error: dErr } = await supabaseClient.from('donors').update(donorPayload).eq('user_id', pv.donor_id);
      if (dErr) return this.toast(dErr.message);
    }

    const { error: upErr } = await supabaseClient.from('pending_verifications').update({ status: 'verified', responded_at: new Date().toISOString() }).eq('id', id);
    if (upErr) return this.toast(upErr.message);
    await this.audit('approve_verification', 'verification', id, { donor_id: pv.donor_id, requester_id: pv.requester_id });
    this.toast('Verification approved');
    await Promise.all([this.loadVerifications(), this.loadDonors(), this.loadOverview(), this.loadLeaderboard()]);
  },

  async rejectVerification(id) {
    const { error } = await supabaseClient.from('pending_verifications').update({ status: 'rejected', responded_at: new Date().toISOString() }).eq('id', id);
    if (error) return this.toast(error.message);
    await this.audit('reject_verification', 'verification', id);
    this.toast('Verification rejected');
    await Promise.all([this.loadVerifications(), this.loadOverview()]);
  },

  async deleteVerification(id) {
    if (!confirm('Delete this verification row?')) return;
    const { error } = await supabaseClient.from('pending_verifications').delete().eq('id', id);
    if (error) return this.toast(error.message);
    await this.audit('delete_verification', 'verification', id);
    this.toast('Verification deleted');
    await Promise.all([this.loadVerifications(), this.loadOverview()]);
  },

  async loadLeaderboard() {
    if (!this.adminRow) return;
    const { data: donors, error } = await supabaseClient.from('donors').select('user_id, full_name, district, total_donations').order('total_donations', { ascending: false }).limit(10);
    if (error) return this.toast(error.message);
    document.getElementById('leaderboard-all').innerHTML = (donors || []).map((d, i) => `<div class="list-card flex items-center justify-between gap-3"><div><p class="font-bold">#${i+1} ${d.full_name || 'Unnamed'}</p><small>${d.district || 'Area not set'}</small></div><div class="text-right"><div class="text-lg font-black">${d.total_donations || 0}</div><small class="text-slate-500">donations</small></div></div>`).join('') || '<div class="text-slate-500">No data.</div>';

    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    const { data: monthEvents, error: mErr } = await supabaseClient.from('donation_events').select('donor_id, points, donors!inner(full_name, district)').gte('verified_at', start.toISOString()).limit(500);
    if (mErr) return this.toast(mErr.message);
    const map = new Map();
    (monthEvents || []).forEach(ev => {
      const item = map.get(ev.donor_id) || { name: ev.donors.full_name || 'Unnamed', district: ev.donors.district || 'Area not set', points: 0, count: 0 };
      item.points += ev.points || 0; item.count += 1; map.set(ev.donor_id, item);
    });
    const ranked = [...map.entries()].sort((a,b) => b[1].points - a[1].points).slice(0,10);
    document.getElementById('leaderboard-month').innerHTML = ranked.map(([id, r], i) => `<div class="list-card flex items-center justify-between gap-3"><div><p class="font-bold">#${i+1} ${r.name}</p><small>${r.district}</small></div><div class="text-right"><div class="text-lg font-black">${r.points}</div><small class="text-slate-500">${r.count} verified</small></div></div>`).join('') || '<div class="text-slate-500">No monthly data.</div>';
  },

  async loadSettings() {
    if (!this.adminRow) return;
    const wanted = ['auto_expire_days', 'emergency_alert_min_bags', 'cooldown_days', 'alert_priority_scope'];
    const { data, error } = await supabaseClient.from('app_settings').select('*').in('key', wanted);
    if (error) return this.toast(error.message);
    const get = (key, fallback) => data?.find(x => x.key === key)?.value ?? fallback;
    document.getElementById('setting-auto-expire-days').value = get('auto_expire_days', 4);
    document.getElementById('setting-emergency-min-bags').value = get('emergency_alert_min_bags', 2);
    document.getElementById('setting-cooldown-days').value = get('cooldown_days', 90);
    document.getElementById('setting-alert-priority-scope').value = get('alert_priority_scope', 'upazila_first');
  },

  async saveSettings() {
    const payloads = [
      { key: 'auto_expire_days', value: Number(document.getElementById('setting-auto-expire-days').value || 4) },
      { key: 'emergency_alert_min_bags', value: Number(document.getElementById('setting-emergency-min-bags').value || 2) },
      { key: 'cooldown_days', value: Number(document.getElementById('setting-cooldown-days').value || 90) },
      { key: 'alert_priority_scope', value: document.getElementById('setting-alert-priority-scope').value || 'upazila_first' }
    ];
    const { error } = await supabaseClient.from('app_settings').upsert(payloads, { onConflict: 'key' });
    if (error) return this.toast(error.message);
    await this.audit('save_settings', 'settings', null, Object.fromEntries(payloads.map(x => [x.key, x.value])));
    this.toast('Settings saved');
  },

  async runQuickReset(kind) {
    if (!this.session?.user) return;
    if (kind === 'cooldown') {
      const { error } = await supabaseClient.from('donors').update({ is_available: true, availability_locked: false, cooldown_until: null, cooldown_reason: null, last_donation_date: null }).eq('user_id', this.session.user.id);
      if (error) return this.toast(error.message);
      this.toast('Your cooldown reset');
      return Promise.all([this.loadDonors(), this.loadOverview()]);
    }
    if (kind === 'pending') {
      const { error } = await supabaseClient.from('pending_verifications').delete().eq('status', 'pending');
      if (error) return this.toast(error.message);
      this.toast('Pending rows cleared');
      return Promise.all([this.loadVerifications(), this.loadOverview()]);
    }
    if (kind === 'expired') {
      const cutoff = new Date(Date.now() - (Number(document.getElementById('setting-auto-expire-days').value || 4) * 24 * 60 * 60 * 1000)).toISOString();
      const { error } = await supabaseClient.from('blood_requests').update({ status: 'expired' }).lt('created_at', cutoff).eq('status', 'open');
      if (error) return this.toast(error.message);
      this.toast('Old requests expired');
      return Promise.all([this.loadRequests(), this.loadOverview()]);
    }
  },

  async logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'admin-login.html';
  }
};

window.BloodLinkAdmin = BloodLinkAdmin;
document.addEventListener('DOMContentLoaded', () => BloodLinkAdmin.init());
