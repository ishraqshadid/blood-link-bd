
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const requestId = params.get('id');
  const loading = document.getElementById('request-loading');
  const content = document.getElementById('request-content');

  if (!requestId) {
    loading.innerHTML = `<div class="page-empty p-10 text-center text-sm font-bold text-slate-500">${'Request not found.'}</div>`;
    return;
  }

  const { data: requestRow, error } = await supabaseClient.from('blood_requests').select('*').eq('id', requestId).single();
  if (error || !requestRow) {
    loading.innerHTML = `<div class="page-empty p-10 text-center text-sm font-bold text-slate-500">${'Request not found.'}</div>`;
    return;
  }

  document.getElementById('request-critical-tag').textContent = requestRow.urgency_level || 'Urgent Need';
  document.getElementById('request-blood-group').textContent = requestRow.blood_group || '--';
  document.getElementById('request-patient-name').textContent = requestRow.patient_name || 'Unknown patient';
  document.getElementById('request-units').textContent = `${requestRow.units || 0} ${'bags needed'}`;
  document.getElementById('request-hospital').textContent = requestRow.hospital_name || 'Hospital not set';
  document.getElementById('request-date').textContent = formatDateShort(requestRow.created_at);
  document.getElementById('request-time').textContent = formatDateTime(requestRow.created_at).split(',').slice(-1)[0].trim();
  document.getElementById('request-location').textContent = [requestRow.upazila, requestRow.district].filter(Boolean).join(', ') || 'Area not set';
  document.getElementById('request-note').textContent = requestRow.note || requestRow.additional_note || 'No additional note added.';

  const callButton = document.getElementById('request-call-btn');
  callButton.href = `tel:${requestRow.contact_number || ''}`;

  const messageButton = document.getElementById('request-message-btn');
  messageButton.onclick = () => {
    const number = requestRow.contact_number || '';
    if (!number) return;
    window.open(`https://wa.me/+88${number}`, '_blank');
  };

  const shareButton = document.getElementById('request-share-btn');
  shareButton.onclick = async () => {
    const url = window.location.href;
    const text = 'Urgent blood request on BloodLink.';
    if (navigator.share && window.isSecureContext) {
      await navigator.share({ title: document.title, text, url }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url).then(() => alert('Link copied.')).catch(() => prompt('Copy this link', url));
  };

  loading.classList.add('hidden');
  content.classList.remove('hidden');
});
