// sw.js - Service Worker for BloodLink BD
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : { 
        title: 'Blood donation verification', 
        body: 'Did you receive blood today?',
        id: 'pending-verify'
    };
    
    const options = {
        body: data.body,
        icon: 'icon.png', 
        badge: 'badge.png',
        tag: data.id, 
        requireInteraction: true, // Eta user click na kora porjonto sorbe na (Tomar idea onujayi)
        renotify: true,
        vibrate: [200, 100, 200],
        data: { verificationId: data.verificationId }, // ID ta pass korlam
        actions: [
            { action: 'yes', title: 'Yes, I received it' },
            { action: 'no', title: 'No, I did not receive it' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification bare Yes/No chaple ja hobe
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    const verificationId = event.notification.data.verificationId;
    let status = (event.action === 'yes') ? 'verified' : 'rejected';

    // Background e API call kore database update korar jonno
    // Tumi ekhane tomar ekta backend endpoint ba edge function call korbe
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            // Jodi kono tab open thake, sekhane message pathate paro
            for (let client of windowClients) {
                client.postMessage({ type: 'VERIFICATION_UPDATE', id: verificationId, status: status });
            }
            
            // Or, tumi chaile user ke ekta success page e niye jete paro
            let url = `/donor-profile.html?verify=${status}&verifyId=${verificationId}`;
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});