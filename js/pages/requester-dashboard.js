
document.addEventListener('DOMContentLoaded', fetchMyPosts);

async function fetchMyPosts() {
  const container = document.getElementById('my-requests-container');

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const { data, error } = await supabaseClient
    .from('blood_requests')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<p class="text-red-500 text-center font-bold">${error.message}</p>`;
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = `<div class="page-empty p-10 text-center"><i class="fa-solid fa-folder-open text-4xl text-slate-300 mb-3"></i><h3 class="font-bold text-slate-700 dark:text-white">${t('No posts found', 'কোনো পোস্ট পাওয়া যায়নি')}</h3><p class="text-xs text-slate-500 mt-1">${t("You haven't posted any blood requests yet.", 'আপনি এখনো কোনো রক্তের পোস্ট দেননি।')}</p></div>`;
    return;
  }

  container.innerHTML = data.map(item => {
    const createdText = formatDateTime(item.created_at);
    return `
      <article class="premium-card p-5 space-y-4">
        <div class="flex justify-between items-start gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-brand rounded-2xl flex items-center justify-center font-black text-xl border border-red-100 dark:border-red-900/30">${item.blood_group || '--'}</div>
            <div>
              <h3 class="font-bold text-slate-900 dark:text-white">${item.patient_name || t('Unknown patient', 'অজানা রোগী')}</h3>
              <p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"><i class="fa-regular fa-clock"></i> ${createdText}</p>
            </div>
          </div>
          <button onclick="deletePost('${item.id}')" class="text-slate-300 hover:text-red-500 transition p-2 text-lg"><i class="fa-solid fa-trash-can"></i></button>
        </div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl text-xs space-y-1 text-slate-600 dark:text-slate-400 font-medium border border-slate-100 dark:border-slate-800">
          <p><i class="fa-solid fa-hospital mr-2 text-brand/50"></i> ${item.hospital_name || t('Hospital not set', 'হাসপাতালের নাম দেওয়া হয়নি')}</p>
          <p><i class="fa-solid fa-location-dot mr-2 text-brand/50"></i> ${[item.upazila, item.district].filter(Boolean).join(', ') || t('Area not set', 'এলাকা দেওয়া হয়নি')}</p>
          <p><i class="fa-solid fa-droplet mr-2 text-brand"></i> ${item.units || 0} ${t('bag(s)', 'ব্যাগ')}</p>
        </div>
        <a href="request-details.html?id=${item.id}" class="block w-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white py-3 rounded-2xl text-sm font-bold text-center">${t('View details', 'বিস্তারিত')}</a>
      </article>
    `;
  }).join('');
}

async function deletePost(postId) {
  if (!postId) return;
  if (!confirm(t('Do you want to delete this post?', 'Are you sure you want to delete this post?'))) return;

  const { error } = await supabaseClient.from('blood_requests').delete().eq('id', postId);
  if (error) {
    alert(error.message);
    return;
  }

  alert(t('Post deleted successfully.', 'Post deleted successfully.'));
  fetchMyPosts();
}
