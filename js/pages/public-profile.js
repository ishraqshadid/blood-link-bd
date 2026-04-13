
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const donorId = params.get('id');
  if (!donorId) return;

  const { data: donor, error } = await supabaseClient.from('donors').select('*').eq('user_id', donorId).single();
  if (error || !donor) return;

  document.getElementById('view-name').innerText = donor.full_name || t('Unnamed donor', 'নামহীন ডোনার');
  document.getElementById('view-bg').innerText = donor.blood_group || '--';
  document.getElementById('view-count').innerText = donor.total_donations || 0;
  document.getElementById('view-badge-container').innerHTML = getBadgeHTML(donor.total_donations || 0);
  document.getElementById('view-location').innerHTML = `<i class="fa-solid fa-location-dot mr-1 text-brand/70"></i> ${[donor.upazila, donor.district].filter(Boolean).join(', ') || t('Location not shared', 'লোকেশন শেয়ার করা হয়নি')}`;

  const avatarContainer = document.getElementById('view-avatar-container');
  if (donor.avatar_url) {
    avatarContainer.innerHTML = `<img src="${donor.avatar_url}" class="w-full h-full object-cover">`;
  } else {
    avatarContainer.innerHTML = `<span class="text-4xl">${(donor.full_name || 'U').charAt(0)}</span>`;
  }

  if (donor.bio && donor.bio.trim()) {
    document.getElementById('bio-section').classList.remove('hidden');
    document.getElementById('view-bio').innerText = donor.bio;
  }

  document.getElementById('call-btn').href = `tel:${donor.phone_number || donor.phone || ''}`;
  document.getElementById('wa-btn').href = `https://wa.me/+88${donor.phone_number || donor.phone || ''}`;
});

function sharePublicProfile() {
  const profileUrl = window.location.href;
  const shareText = t(`Contact ${document.getElementById('view-name').innerText} for blood donation.`, `${document.getElementById('view-name').innerText} এর সাথে রক্তদানের জন্য যোগাযোগ করুন।`);
  if (navigator.share && window.isSecureContext) {
    navigator.share({ title: t('Donor Profile', 'ডোনার প্রোফাইল'), text: shareText, url: profileUrl }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(profileUrl).then(() => {
    alert(t('Profile link copied.', 'প্রোফাইল লিংক কপি হয়েছে।'));
  }).catch(() => {
    prompt(t('Copy this link', 'এই লিংক কপি করুন'), profileUrl);
  });
}
