// Configurações e constantes
const CONFIG = {
    TAX_RATE: 0.1, // 10% de impostos
    PAYMENT_PROCESSING_DELAY: 3000,
    SUCCESS_RATE: 0.95,
    EMAIL_SERVICE_ID: "service_6tfw68v",
    EMAIL_TEMPLATE_ID: "template_b9f8pmh",
    EMAIL_USER_ID: "BJdrV31e0EVKd53Cd",
    NOTIFICATION_EMAIL: "kauagomesabencoado@gmail.com"
};

// Estado da aplicação
const appState = {
    selectedPlan: null,
    selectedPayment: null,
    isProcessing: false
};

// Utilitários
const utils = {
    formatCurrency: (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },
    formatPhone: (value) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 10) {
            return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
        } else {
            return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
    },
    formatDocument: (value) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 11) {
            return numbers
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else {
            return numbers
                .replace(/^(\d{2})(\d)/, '$1.$2')
                .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                .replace(/\.(\d{3})(\d)/, '.$1/$2')
                .replace(/(\d{4})(\d)/, '$1-$2');
        }
    },
    formatCardNumber: (value) => {
        const numbers = value.replace(/\D/g, '').substr(0, 19);
        return numbers.replace(/(\d{4})(?=\d)/g, '$1 ');
    },
    formatCardExpiry: (value) => {
        const numbers = value.replace(/\D/g, '').substr(0, 4);
        if (numbers.length <= 2) return numbers;
        return numbers.replace(/(\d{2})(\d{1,2})/, '$1/$2');
    },
    generateTransactionId: () => {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substr(2, 9).toUpperCase();
        return `TXN-${timestamp}-${randomStr}`;
    },
    validateEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    validateCardNumber: (cardNumber) => {
        const numbers = cardNumber.replace(/\D/g, '');
        return numbers.length >= 13 && numbers.length <= 19;
    },
    validateCardExpiry: (expiry) => {
        const parts = expiry.split('/');
        if (parts.length !== 2) return false;
        const [monthStr, yearStr] = parts;
        if (!/^\d{2}$/.test(monthStr) || !/^\d{2}$/.test(yearStr)) return false;

        const month = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);
        if (month < 1 || month > 12) return false;

        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;

        if (year < currentYear) return false;
        if (year === currentYear && month < currentMonth) return false;

        return true;
    }
};

// Gerenciamento de UI
const ui = {
    showError: (message) => {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.setAttribute('role', 'alert');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    },
    hideError: () => {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    },
    showLoading: () => {
        const form = document.getElementById('checkoutForm');
        const loading = document.getElementById('loading');
        if (form) form.style.display = 'none';
        if (loading) loading.style.display = 'block';
    },
    hideLoading: () => {
        const form = document.getElementById('checkoutForm');
        const loading = document.getElementById('loading');
        if (form) form.style.display = 'block';
        if (loading) loading.style.display = 'none';
    },
    showSuccess: () => {
        const form = document.getElementById('checkoutForm');
        const loading = document.getElementById('loading');
        const success = document.getElementById('successMessage');
        if (form) form.style.display = 'none';
        if (loading) loading.style.display = 'none';
        if (success) success.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    updateFieldError: (field, hasError) => {
        if (field) {
            field.style.borderColor = hasError ? '#dc2626' : '#e5e7eb';
            field.setAttribute('aria-invalid', hasError);
        }
    }
};

// Gerenciamento de planos
const planManager = {
    init: () => {
        const planOptions = document.querySelectorAll('.plan-option');
        planOptions.forEach(option => {
            option.addEventListener('click', planManager.selectPlan);
        });
    },
    selectPlan: function() {
        document.querySelectorAll('.plan-option').forEach(p => {
            p.classList.remove('selected');
            p.setAttribute('aria-selected', 'false');
        });

        this.classList.add('selected');
        this.setAttribute('aria-selected', 'true');

        const planNameElement = this.querySelector('.plan-name');
        const planName = planNameElement ? planNameElement.textContent.trim() : '';
        const planPrice = parseFloat(this.dataset.price) || 0;
        const planType = this.dataset.plan || '';

        appState.selectedPlan = { name: planName, price: planPrice, type: planType };

        orderManager.updateSummary();
    }
};

// Gerenciamento de pagamentos
const paymentManager = {
    init: () => {
        const paymentOptions = document.querySelectorAll('.payment-option');
        paymentOptions.forEach(option => {
            option.addEventListener('click', paymentManager.selectPayment);
        });
    },
    selectPayment: function() {
        document.querySelectorAll('.payment-option').forEach(p => {
            p.classList.remove('selected');
            p.setAttribute('aria-selected', 'false');
        });

        this.classList.add('selected');
        this.setAttribute('aria-selected', 'true');

        appState.selectedPayment = this.dataset.method;

        paymentManager.togglePaymentFields();
    },
    togglePaymentFields: () => {
        const cardInputs = document.getElementById('cardInputs');
        const pixInfo = document.getElementById('pixInfo');

        if (cardInputs) cardInputs.classList.remove('active');
        if (pixInfo) pixInfo.classList.remove('active');

        if (appState.selectedPayment === 'card' && cardInputs) {
            cardInputs.classList.add('active');
        } else if (appState.selectedPayment === 'pix' && pixInfo) {
            pixInfo.classList.add('active');
        }
    }
};

// Gerenciamento de pedidos
const orderManager = {
    updateSummary: () => {
        const orderDetails = document.getElementById('orderDetails');
        if (!orderDetails || !appState.selectedPlan) return;

        const planPrice = appState.selectedPlan.price;
        const tax = planPrice * CONFIG.TAX_RATE;
        const total = planPrice + tax;

        orderDetails.innerHTML = `
            <div class="order-item">
                <span>${appState.selectedPlan.name}</span>
                <span>${utils.formatCurrency(planPrice)}</span>
            </div>
            <div class="order-item">
                <span>Impostos</span>
                <span>${utils.formatCurrency(tax)}</span>
            </div>
            <div class="order-item total">
                <span>Total</span>
                <span>${utils.formatCurrency(total)}</span>
            </div>
        `;
    }
};

// Formatação de campos
const fieldFormatter = {
    init: () => {
        const phoneField = document.querySelector('input[name="telefone"]');
        const documentField = document.querySelector('input[name="documento"]');
        const cardNumberField = document.querySelector('input[name="cardNumber"]');
        const cardExpiryField = document.querySelector('input[name="cardExpiry"]');

        if (phoneField) phoneField.addEventListener('input', fieldFormatter.formatPhone);
        if (documentField) documentField.addEventListener('input', fieldFormatter.formatDocument);
        if (cardNumberField) cardNumberField.addEventListener('input', fieldFormatter.formatCardNumber);
        if (cardExpiryField) cardExpiryField.addEventListener('input', fieldFormatter.formatCardExpiry);
    },
    formatPhone: (e) => {
        e.target.value = utils.formatPhone(e.target.value);
    },
    formatDocument: (e) => {
        e.target.value = utils.formatDocument(e.target.value);
    },
    formatCardNumber: (e) => {
        e.target.value = utils.formatCardNumber(e.target.value);
    },
    formatCardExpiry: (e) => {
        e.target.value = utils.formatCardExpiry(e.target.value);
    }
};

// Validação de formulário
const validator = {
    validateForm: () => {
        let hasError = false;
        const errors = [];

        if (!appState.selectedPlan) {
            errors.push('Por favor, selecione um plano.');
            hasError = true;
        }

        if (!appState.selectedPayment) {
            errors.push('Por favor, selecione um método de pagamento.');
            hasError = true;
        }

        const form = document.getElementById('checkoutForm');
        if (form) {
            const requiredFields = form.querySelectorAll('[required]');
            requiredFields.forEach(field => {
                const isValid = validator.validateField(field);
                ui.updateFieldError(field, !isValid);
                if (!isValid) hasError = true;
            });
        }

        if (appState.selectedPayment === 'card') {
            const cardValidation = validator.validateCardFields();
            if (!cardValidation.isValid) {
                hasError = true;
                errors.push(...cardValidation.errors);
            }
        }

        if (hasError && errors.length > 0) {
            ui.showError(errors[0]);
        }

        return !hasError;
    },
    validateField: (field) => {
        if (!field.value.trim()) return false;
        if (field.type === 'email') return utils.validateEmail(field.value);
        return true;
    },
    validateCardFields: () => {
        const errors = [];
        let isValid = true;

        const cardNumber = document.querySelector('input[name="cardNumber"]');
        const cardExpiry = document.querySelector('input[name="cardExpiry"]');
        const cardCvv = document.querySelector('input[name="cardCvv"]');
        const cardName = document.querySelector('input[name="cardName"]');

        if (cardNumber && !utils.validateCardNumber(cardNumber.value)) {
            ui.updateFieldError(cardNumber, true);
            errors.push('Número do cartão inválido.');
            isValid = false;
        }

        if (cardExpiry && !utils.validateCardExpiry(cardExpiry.value)) {
            ui.updateFieldError(cardExpiry, true);
            errors.push('Data de validade inválida.');
            isValid = false;
        }

        if (cardCvv && (!cardCvv.value.trim() || cardCvv.value.length < 3)) {
            ui.updateFieldError(cardCvv, true);
            errors.push('CVV inválido.');
            isValid = false;
        }

        if (cardName && !cardName.value.trim()) {
            ui.updateFieldError(cardName, true);
            errors.push('Nome no cartão é obrigatório.');
            isValid = false;
        }

        return { isValid, errors };
    }
};

// Processador de pagamento
const paymentProcessor = {
    process: async () => {
        if (appState.isProcessing) return;

        if (!validator.validateForm()) return;

        appState.isProcessing = true;
        ui.hideError();
        ui.showLoading();

        // Simular atraso de processamento
        await new Promise(resolve => setTimeout(resolve, CONFIG.PAYMENT_PROCESSING_DELAY));

        // Simular sucesso ou falha do pagamento
        const isSuccess = Math.random() <= CONFIG.SUCCESS_RATE;

        if (!isSuccess) {
            ui.hideLoading();
            ui.showError('Falha no processamento do pagamento. Tente novamente.');
            appState.isProcessing = false;
            return;
        }

        // Gerar ID da transação
        const transactionId = utils.generateTransactionId();

        // Enviar email via EmailJS direto aqui (antes só no sendNotification)
        try {
            const emailParams = {
                to_email: CONFIG.NOTIFICATION_EMAIL,
                transaction_id: transactionId,
                plan_name: appState.selectedPlan.name,
                plan_price: utils.formatCurrency(appState.selectedPlan.price),
                payment_method: appState.selectedPayment,
                user_name: document.querySelector('input[name="nome"]')?.value || 'Cliente',
                user_email: document.querySelector('input[name="email"]')?.value || '',
                user_phone: document.querySelector('input[name="telefone"]')?.value || ''
            };

            // Enviar email via emailjs
            await emailjs.send(
                CONFIG.EMAIL_SERVICE_ID,
                CONFIG.EMAIL_TEMPLATE_ID,
                emailParams,
                CONFIG.EMAIL_USER_ID
            );

            // Sucesso total
            ui.showSuccess();
        } catch (error) {
            ui.hideLoading();
            ui.showError('Erro ao enviar a confirmação por email. Tente novamente.');
            appState.isProcessing = false;
            return;
        }

        appState.isProcessing = false;
    }
};

// Inicialização geral
const init = () => {
    planManager.init();
    paymentManager.init();
    fieldFormatter.init();

    const form = document.getElementById('checkoutForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            paymentProcessor.process();
        });
    }

    // Inicializa o emailjs SDK (deve incluir <script src="https://cdn.emailjs.com/sdk/2.3.2/email.min.js"></script>)
    if (typeof emailjs !== 'undefined') {
        emailjs.init(CONFIG.EMAIL_USER_ID);
    }
};

// Executar init quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);
