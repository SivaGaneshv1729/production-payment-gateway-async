import './styles.css';
import { createModal, openModal, closeModal } from './modal';

class PaymentGateway {
    constructor(options) {
        this.options = options || {};
        this.modal = null;
        this.iframe = null;
        this.handleMessage = this.handleMessage.bind(this);
    }

    open() {
        if (!this.options.key) {
            console.error('PaymentGateway: API Key is required');
            return;
        }

        if (this.modal) {
            openModal(this.modal);
            return;
        }

        // Create Modal & Iframe
        const { modal, iframe } = createModal();
        this.modal = modal;
        this.iframe = iframe;

        // Construct checkout URL
        // Pointing to the locally running checkout service
        const baseUrl = 'http://localhost:3001/checkout';
        const params = new URLSearchParams({
            order_id: this.options.orderId,
            embedded: 'true', // Flag to tell checkout page it's in an iframe
            key: this.options.key
        });

        iframe.src = `${baseUrl}?${params.toString()}`;

        // Listen for events from Iframe
        window.addEventListener('message', this.handleMessage);

        // Open it
        openModal(this.modal);
    }

    close() {
        if (this.modal) {
            closeModal(this.modal);
            window.removeEventListener('message', this.handleMessage);

            // Optional callback
            if (typeof this.options.onClose === 'function') {
                this.options.onClose();
            }

            // Cleanup DOM to ensure fresh state next time
            document.body.removeChild(this.modal);
            this.modal = null;
            this.iframe = null;
        }
    }

    handleMessage(event) {
        // In production, validate event.origin here
        // if (event.origin !== 'http://localhost:3001') return;

        const { type, data } = event.data;

        if (type === 'payment_success') {
            if (typeof this.options.onSuccess === 'function') {
                this.options.onSuccess(data);
            }
            this.close();
        } else if (type === 'payment_failed') {
            if (typeof this.options.onFailure === 'function') {
                this.options.onFailure(data);
            }
            // We don't necessarily close on failure, let user try again
        } else if (type === 'close_modal') {
            this.close();
        }
    }
}

export default PaymentGateway;
