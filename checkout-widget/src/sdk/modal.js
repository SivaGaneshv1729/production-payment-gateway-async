export function createModal() {
    // Container
    const modal = document.createElement('div');
    modal.id = 'payment-gateway-modal';
    modal.dataset.testId = 'payment-modal';
    modal.className = 'pg-modal-overlay';

    // Content Wrapper
    const content = document.createElement('div');
    content.className = 'pg-modal-content';

    // Close Button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pg-close-button';
    closeBtn.dataset.testId = 'close-modal-button';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => {
        // We can't access the instance directly here easily without binding, 
        // but the instance methods handle cleanup. 
        // For simplicity, we can just remove it or trigger a custom event.
        // Better way: The SDK implements the close logic. 
        // This button will just emit a message or call a global handler if needed.
        // Actually, let's just dispatch a click event that the class uses? 
        // Or simpler: pass a callback to createModal?
        // Let's rely on the SDK instance calling close() effectively, 
        // but here we just need to hide it visually or let the user click "X".
        // For this implementation, we will let the SDK instance handle the click if we passed a callback,
        // but since we didn't, we'll just dispatch an event on the window or similar.
        // Let's trigger a close_modal message to self for consistency?
        // OR simpler: find the instance? No.
        // Let's just remove the element for now, but that bypasses callbacks.
        // REVISION: The SDK class should attach the listener to this button.
        // We will just return the button element.
    };

    // Iframe
    const iframe = document.createElement('iframe');
    iframe.dataset.testId = 'payment-iframe';
    iframe.className = 'pg-iframe';

    content.appendChild(closeBtn);
    content.appendChild(iframe);
    modal.appendChild(content);

    // Attach to body (hidden by default via CSS)
    document.body.appendChild(modal);

    // Return elements so SDK can attach listeners
    return { modal, iframe, closeBtn };
}

export function openModal(modal) {
    modal.style.display = 'flex';
    // Slight delay for animation if needed
    setTimeout(() => modal.classList.add('open'), 10);
}

export function closeModal(modal) {
    modal.classList.remove('open');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}
