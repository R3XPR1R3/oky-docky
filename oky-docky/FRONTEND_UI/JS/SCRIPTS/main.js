/**
 * ========================================
 * OKY DOCKY - ГЛАВНЫЙ JAVASCRIPT ФАЙЛ
 * Полная интеграция с API + Anime.js анимации
 * ========================================
 */

class OkyDockyApp {
    constructor() {
        // Настройки API
        this.apiBase = window.location.origin + '/api';
        
        // Состояние приложения
        this.templates = {};
        this.currentTemplate = null;
        this.currentFieldData = null;
        this.isLoading = false;
        
        // Настройки темы
        this.theme = localStorage.getItem('oky-theme') || 'light';
        
        // Элементы DOM
        this.elements = {
            // Навигация
            header: document.getElementById('header'),
            themeToggle: document.getElementById('themeToggle'),
            navLinks: document.querySelectorAll('.nav-link'),
            
            // Hero секция
            heroTitle: document.getElementById('heroTitle'),
            heroSubtitle: document.getElementById('heroSubtitle'),
            heroCta: document.getElementById('heroCta'),
            stats: document.getElementById('stats'),
            
            // Поиск и шаблоны
            searchInput: document.getElementById('searchInput'),
            templatesGrid: document.getElementById('templatesGrid'),
            emptyState: document.getElementById('emptyState'),
            
            // Модальные окна
            generateModal: document.getElementById('generateModal'),
            formatModal: document.getElementById('formatModal'),
            generateForm: document.getElementById('generateForm'),
            formFields: document.getElementById('formFields'),
            
            // Уведомления
            toast: document.getElementById('toast'),
            toastMessage: document.getElementById('toastMessage')
        };
        
        // Инициализация
        this.init();
    }

    /**
     * ========================================
     * ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
     * ========================================
     */
    async init() {
        console.log('🚀 Инициализация Oky Docky...');
        
        try {
            // Настройка темы
            this.setupTheme();
            
            // Обработчики событий
            this.setupEventListeners();
            
            // Запуск анимаций
            this.initAnimations();
            
            // Загрузка данных с API
            await this.loadTemplates();
            
            // Отображение шаблонов
            this.renderTemplates();
            
            // Загрузка статистики
            await this.loadStats();
            
            console.log('✅ Oky Docky готов к работе!');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.showToast('Ошибка инициализации приложения', 'error');
        }
    }

    /**
     * ========================================
     * РАБОТА С API
     * ========================================
     */
    
    // Загрузка списка шаблонов
    async loadTemplates() {
        console.log('📥 Загрузка шаблонов...');
        
        try {
            this.setLoading(true);
            
            const response = await fetch(`${this.apiBase}/templates`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.templates = data.templates || {};
                console.log(`✅ Загружено шаблонов: ${data.total || Object.keys(this.templates).length}`);
                
                // Отладочная информация
                Object.entries(this.templates).forEach(([name, template]) => {
                    console.log(`📄 ${name}: ${template.stats?.total_placeholders || 0} переменных`);
                });
                
                return this.templates;
            } else {
                throw new Error(data.message || 'Не удалось загрузить шаблоны');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки шаблонов:', error);
            this.showToast('Ошибка загрузки шаблонов. Загружаются демо-данные...', 'warning');
            
            // Fallback на демо-данные
            this.loadDemoTemplates();
            return this.templates;
            
        } finally {
            this.setLoading(false);
        }
    }

    // Загрузка статистики
    async loadStats() {
        try {
            const response = await fetch(`${this.apiBase}/stats`);
            
            if (response.ok) {
                const stats = await response.json();
                this.updateStatsDisplay(stats);
            }
        } catch (error) {
            console.warn('⚠️ Статистика недоступна:', error);
        }
    }

    // Отладка шаблона
    async debugTemplate(templateName) {
        try {
            console.log(`🔍 Отладка шаблона: ${templateName}`);
            
            const response = await fetch(`${this.apiBase}/debug/placeholder_test/${encodeURIComponent(templateName)}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔬 Отладочная информация:', data);
                return data;
            }
            
        } catch (error) {
            console.error('❌ Ошибка отладки:', error);
        }
    }

    // Генерация документа
    async generateDocument(formatType) {
        if (!this.currentTemplate || !this.currentFieldData) {
            this.showToast('Ошибка: данные не найдены', 'error');
            return;
        }

        try {
            console.log(`🔄 Генерация документа: ${this.currentTemplate.name}, формат: ${formatType}`);
            console.log('📝 Данные:', this.currentFieldData);
            
            this.closeAllModals();
            this.showToast('Генерация документа...', 'info');
            this.setLoading(true);

            // Подготовка FormData (как ожидает бэкенд)
            const formData = new FormData();
            formData.append('format_type', formatType);
            formData.append('field_data', JSON.stringify(this.currentFieldData));

            // Отправка запроса
            const response = await fetch(`${this.apiBase}/generate/${encodeURIComponent(this.currentTemplate.name)}`, {
                method: 'POST',
                body: formData
            });

            console.log(`📡 Статус ответа: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('📄 Результат генерации:', result);

            if (result.success) {
                this.showToast('Документ успешно сгенерирован!', 'success');
                
                // Анимация успеха
                this.animateSuccess();
                
                // Скачивание файла
                if (result.download_url) {
                    setTimeout(() => {
                        console.log(`⬇️ Скачивание: ${result.download_url}`);
                        window.open(result.download_url, '_blank');
                    }, 1000);
                }
                
                // Обновляем статистику
                this.loadStats();
                
            } else {
                throw new Error(result.message || 'Неизвестная ошибка генерации');
            }

        } catch (error) {
            console.error('❌ Ошибка генерации:', error);
            this.showToast(`Ошибка генерации: ${error.message}`, 'error');
            
        } finally {
            this.setLoading(false);
        }
    }

    // Загрузка нового шаблона
    async uploadTemplate(file, templateName, templateId = null) {
        try {
            console.log(`📤 Загрузка шаблона: ${file.name}`);
            
            this.setLoading(true);
            this.showToast('Загрузка шаблона...', 'info');

            const formData = new FormData();
            formData.append('file', file);
            if (templateName) formData.append('name', templateName);
            if (templateId) formData.append('form_id', templateId);

            const response = await fetch(`${this.apiBase}/upload-template`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showToast(`Шаблон загружен! Найдено ${result.placeholders_found} переменных`, 'success');
                
                // Перезагружаем список шаблонов
                await this.loadTemplates();
                this.renderTemplates();
                
                return result;
            } else {
                throw new Error(result.message || 'Ошибка загрузки');
            }

        } catch (error) {
            console.error('❌ Ошибка загрузки шаблона:', error);
            this.showToast(`Ошибка загрузки: ${error.message}`, 'error');
            
        } finally {
            this.setLoading(false);
        }
    }

    // Валидация переменных
    async validateVariables(templateId, variables) {
        try {
            const response = await fetch(`${this.apiBase}/validate-variables`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    form_id: templateId,
                    variables: variables
                })
            });

            if (response.ok) {
                return await response.json();
            }

        } catch (error) {
            console.warn('⚠️ Валидация недоступна:', error);
        }
        
        return { valid: true }; // Fallback
    }

    /**
     * ========================================
     * РАБОТА С ИНТЕРФЕЙСОМ
     * ========================================
     */

    // Отображение шаблонов
    renderTemplates(filteredTemplates = null) {
        const templatesToRender = filteredTemplates || this.templates;
        
        if (!this.elements.templatesGrid) {
            console.error('❌ Элемент templatesGrid не найден');
            return;
        }

        // Очищаем сетку
        this.elements.templatesGrid.innerHTML = '';

        // Проверяем наличие шаблонов
        if (Object.keys(templatesToRender).length === 0) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();

        // Создаем карточки
        Object.values(templatesToRender).forEach((template, index) => {
            const card = this.createTemplateCard(template, index);
            this.elements.templatesGrid.appendChild(card);
        });

        // Анимация появления карточек
        setTimeout(() => this.animateCards(), 100);
    }

    // Создание карточки шаблона
    createTemplateCard(template, index) {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';
        card.dataset.templateName = template.name;

        // Создаем теги для плейсхолдеров
        const tags = Object.keys(template.placeholders || {}).slice(0, 5).map(placeholder => 
            `<span class="tag">{${placeholder}}</span>`
        ).join('');

        // Показываем если есть еще плейсхолдеры
        const totalPlaceholders = Object.keys(template.placeholders || {}).length;
        const moreTags = totalPlaceholders > 5 ? `<span class="tag">+${totalPlaceholders - 5}</span>` : '';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-icon">${this.getFileIcon(template.name)}</div>
                <div>
                    <div class="card-title">${this.getTemplateDisplayName(template.name)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">
                        ${template.stats?.total_placeholders || 0} переменных • ${this.formatFileSize(template.file_size)}
                    </div>
                </div>
            </div>
            
            <div class="card-description">
                ${template.original_filename || template.name}<br>
                <small style="color: var(--text-muted);">
                    Загружен: ${this.formatDate(template.uploaded_at)}
                </small>
            </div>
            
            <div class="tags" style="margin: 1rem 0;">
                ${tags}${moreTags}
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: auto;">
                <button class="btn btn-primary" style="flex: 1;" onclick="app.openGenerateForm('${template.name}')">
                    Использовать
                </button>
                <button class="btn btn-ghost" onclick="app.debugTemplate('${template.name}')" title="Отладка">
                    🔍
                </button>
            </div>
        `;

        return card;
    }

    // Форма генерации
    openGenerateForm(templateName) {
        console.log(`📝 Открытие формы для: ${templateName}`);
        
        const template = this.templates[templateName];
        if (!template) {
            this.showToast('Шаблон не найден', 'error');
            return;
        }

        this.currentTemplate = template;
        this.renderGenerateForm(template);
        this.showModal('generateModal');
    }

    // Отображение полей формы
    renderGenerateForm(template) {
        if (!this.elements.formFields) return;

        this.elements.formFields.innerHTML = '';

        // Информация о шаблоне
        const templateInfo = document.createElement('div');
        templateInfo.style.cssText = 'margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;';
        templateInfo.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 0.5rem;">📄 ${this.getTemplateDisplayName(template.name)}</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                ${template.stats?.total_placeholders || 0} переменных • ${template.stats?.total_occurrences || 0} вхождений
            </div>
        `;
        this.elements.formFields.appendChild(templateInfo);

        // Поля формы
        const formFields = template.form_fields || this.generateFallbackFields(template);
        
        formFields.forEach(field => {
            const fieldElement = this.createFormField(field);
            this.elements.formFields.appendChild(fieldElement);
        });

        // Анимация появления полей
        setTimeout(() => {
            const fields = this.elements.formFields.querySelectorAll('.input-group');
            anime({
                targets: fields,
                opacity: [0, 1],
                translateY: [10, 0],
                duration: 400,
                easing: 'easeOutCubic',
                delay: anime.stagger(100)
            });
        }, 100);
    }

    // Создание поля формы
    createFormField(field) {
        const div = document.createElement('div');
        div.className = 'input-group';

        let inputElement;
        
        switch (field.type) {
            case 'textarea':
                inputElement = `
                    <textarea 
                        name="${field.name}" 
                        placeholder="${field.placeholder || ''}" 
                        ${field.required ? 'required' : ''} 
                        class="input" 
                        style="min-height: 100px; resize: vertical;"
                    ></textarea>`;
                break;
                
            case 'select':
                const options = field.options?.map(opt => 
                    `<option value="${opt.value}">${opt.label}</option>`
                ).join('') || '';
                inputElement = `
                    <select name="${field.name}" ${field.required ? 'required' : ''} class="input">
                        <option value="">Выберите...</option>
                        ${options}
                    </select>`;
                break;
                
            case 'date':
                inputElement = `
                    <input 
                        type="date" 
                        name="${field.name}" 
                        ${field.required ? 'required' : ''} 
                        class="input"
                        value="${new Date().toISOString().split('T')[0]}"
                    >`;
                break;
                
            default:
                inputElement = `
                    <input 
                        type="${field.type}" 
                        name="${field.name}" 
                        placeholder="${field.placeholder || ''}" 
                        ${field.required ? 'required' : ''} 
                        class="input"
                    >`;
        }

        div.innerHTML = `
            <label class="input-label">
                ${field.label} 
                ${field.required ? '<span style="color: var(--error);">*</span>' : ''}
                ${field.occurrences > 1 ? `<small>(встречается ${field.occurrences} раз)</small>` : ''}
            </label>
            ${inputElement}
            ${field.validation?.message ? 
                `<small style="color: var(--text-muted); margin-top: 0.25rem; display: block;">
                    ${field.validation.message}
                </small>` : ''
            }
        `;

        return div;
    }

    // Обработка отправки формы
    async handleFormSubmit(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        const fieldData = {};

        // Собираем данные
        for (let [key, value] of formData.entries()) {
            fieldData[key] = value.trim();
        }

        console.log('📝 Данные формы:', fieldData);

        // Базовая валидация
        const emptyFields = Object.entries(fieldData).filter(([key, value]) => !value);
        if (emptyFields.length > 0) {
            this.showToast('Заполните все обязательные поля', 'warning');
            return;
        }

        // Валидация через API (если доступна)
        if (this.currentTemplate.id) {
            const validation = await this.validateVariables(this.currentTemplate.id, fieldData);
            if (!validation.valid) {
                this.showToast('Проверьте корректность введенных данных', 'warning');
                return;
            }
        }

        this.currentFieldData = fieldData;
        this.closeModal('generateModal');
        this.showModal('formatModal');
    }

    /**
     * ========================================
     * АНИМАЦИИ С ANIME.JS
     * ========================================
     */

    // Инициализация анимаций
    initAnimations() {
        // Анимация появления хедера
        anime({
            targets: this.elements.header,
            opacity: [0, 1],
            translateY: ['-100%', '0%'],
            duration: 800,
            easing: 'easeOutCubic',
            delay: 100
        });

        // Hero секция
        const heroTimeline = anime.timeline();
        
        if (this.elements.heroTitle) {
            heroTimeline.add({
                targets: this.elements.heroTitle,
                opacity: [0, 1],
                translateY: [30, 0],
                duration: 1000,
                easing: 'easeOutCubic'
            });
        }
        
        if (this.elements.heroSubtitle) {
            heroTimeline.add({
                targets: this.elements.heroSubtitle,
                opacity: [0, 1],
                translateY: [30, 0],
                duration: 800,
                easing: 'easeOutCubic'
            }, '-=700');
        }
        
        if (this.elements.heroCta) {
            heroTimeline.add({
                targets: this.elements.heroCta,
                opacity: [0, 1],
                translateY: [30, 0],
                duration: 600,
                easing: 'easeOutCubic'
            }, '-=500');
        }

        // Анимация поиска
        if (this.elements.searchInput) {
            anime({
                targets: this.elements.searchInput.closest('.search-container'),
                opacity: [0, 1],
                translateY: [20, 0],
                duration: 600,
                easing: 'easeOutCubic',
                delay: 1500
            });
        }

        // Статистика с счетчиками
        this.animateStats();
    }

    // Анимация статистики
    animateStats() {
        if (!this.elements.stats) return;

        const statItems = this.elements.stats.querySelectorAll('.stat-item');
        
        statItems.forEach((item, index) => {
            // Анимация появления
            anime({
                targets: item,
                opacity: [0, 1],
                translateY: [20, 0],
                duration: 600,
                easing: 'easeOutCubic',
                delay: 2000 + (index * 200)
            });

            // Анимация счетчика
            const numberEl = item.querySelector('.stat-number');
            if (!numberEl) return;
            
            const targetCount = parseInt(numberEl.getAttribute('data-count') || '0');
            
            anime({
                targets: { count: 0 },
                count: targetCount,
                duration: 2000,
                easing: 'easeOutCubic',
                delay: 2200 + (index * 200),
                update: function(anim) {
                    const currentCount = Math.round(anim.animations[0].currentValue);
                    const suffix = numberEl.dataset.suffix || '+';
                    numberEl.textContent = currentCount + suffix;
                }
            });
        });
    }

    // Анимация карточек
    animateCards() {
        const cards = this.elements.templatesGrid?.querySelectorAll('.card');
        if (!cards || cards.length === 0) return;
        
        anime({
            targets: cards,
            opacity: [0, 1],
            translateY: [30, 0],
            scale: [0.95, 1],
            duration: 600,
            easing: 'easeOutCubic',
            delay: anime.stagger(100)
        });
    }

    // Анимация успешной генерации
    animateSuccess() {
        // Создаем временный элемент для анимации
        const successElement = document.createElement('div');
        successElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 4rem;
            z-index: 9999;
            pointer-events: none;
        `;
        successElement.textContent = '🎉';
        document.body.appendChild(successElement);

        anime({
            targets: successElement,
            scale: [0, 1.5, 1],
            rotate: [0, 360],
            opacity: [0, 1, 0],
            duration: 2000,
            easing: 'easeOutElastic(1, .8)',
            complete: () => {
                document.body.removeChild(successElement);
            }
        });
    }

    /**
     * ========================================
     * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     * ========================================
     */

    // Настройка темы
    setupTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        if (this.elements.themeToggle && this.theme === 'dark') {
            this.elements.themeToggle.classList.add('active');
        }
    }

    // Переключение темы
    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('oky-theme', this.theme);
        
        if (this.elements.themeToggle) {
            this.elements.themeToggle.classList.toggle('active');
        }
    }

    // Обработчики событий
    setupEventListeners() {
        // Переключение темы
        this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());

        // Поиск
        this.elements.searchInput?.addEventListener('input', (e) => {
            this.filterTemplates(e.target.value);
        });

        // Форма генерации
        this.elements.generateForm?.addEventListener('submit', (e) => {
            this.handleFormSubmit(e);
        });

        // Закрытие модальных окон по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // Клик вне модального окна
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    }

    // Поиск и фильтрация
    filterTemplates(searchTerm) {
        if (!searchTerm.trim()) {
            this.renderTemplates();
            return;
        }

        const filtered = {};
        const term = searchTerm.toLowerCase();

        Object.entries(this.templates).forEach(([key, template]) => {
            const searchableText = [
                template.name,
                template.original_filename,
                ...Object.keys(template.placeholders || {})
            ].join(' ').toLowerCase();

            if (searchableText.includes(term)) {
                filtered[key] = template;
            }
        });

        this.renderTemplates(filtered);
    }

    // Модальные окна
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            
            // Анимация появления
            anime({
                targets: modal.querySelector('.modal-content'),
                scale: [0.9, 1],
                opacity: [0, 1],
                duration: 300,
                easing: 'easeOutCubic'
            });
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Уведомления
    showToast(message, type = 'info') {
        if (!this.elements.toast || !this.elements.toastMessage) return;

        this.elements.toastMessage.textContent = message;
        this.elements.toast.className = `toast show ${type}`;

        // Анимация появления
        anime({
            targets: this.elements.toast,
            translateX: ['100%', '0%'],
            duration: 300,
            easing: 'easeOutCubic'
        });

        // Автоскрытие
        setTimeout(() => {
            anime({
                targets: this.elements.toast,
                translateX: ['0%', '100%'],
                duration: 300,
                easing: 'easeInCubic',
                complete: () => {
                    this.elements.toast.classList.remove('show', type);
                }
            });
        }, type === 'error' ? 5000 : 3000);
    }

    // Состояния загрузки
    setLoading(isLoading) {
        this.isLoading = isLoading;
        
        // Можно добавить глобальный индикатор загрузки
        if (isLoading) {
            document.body.style.cursor = 'wait';
        } else {
            document.body.style.cursor = '';
        }
    }

    // Пустое состояние
    showEmptyState() {
        if (this.elements.emptyState) {
            this.elements.emptyState.classList.remove('hidden');
        }
    }

    hideEmptyState() {
        if (this.elements.emptyState) {
            this.elements.emptyState.classList.add('hidden');
        }
    }

    // Обновление статистики
    updateStatsDisplay(stats) {
        const statItems = [
            { selector: '[data-stat="templates"]', value: stats.templates_count || 0 },
            { selector: '[data-stat="generated"]', value: stats.generated_files_count || 0 },
            { selector: '[data-stat="variables"]', value: stats.total_variables || 0 }
        ];

        statItems.forEach(({ selector, value }) => {
            const element = document.querySelector(selector);
            if (element) {
                element.setAttribute('data-count', value);
            }
        });

        // Перезапуск анимации счетчиков
        this.animateStats();
    }

    // Утилиты форматирования
    getTemplateDisplayName(filename) {
        return filename.split('.')[0]
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    getFileIcon(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        
        const icons = {
            'pdf': '📄',
            'docx': '📝',
            'doc': '📝',
            'txt': '📋',
            'rtf': '📄'
        };
        
        return icons[extension] || '📄';
    }

    formatFileSize(bytes) {
        if (!bytes) return 'Неизвестно';
        
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatDate(dateString) {
        if (!dateString) return 'Неизвестно';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Неверная дата';
        }
    }

    // Генерация fallback полей если нет form_fields
    generateFallbackFields(template) {
        const placeholders = Object.keys(template.placeholders || {});
        
        return placeholders.map(placeholder => ({
            name: placeholder,
            label: this.generateFieldLabel(placeholder),
            type: this.detectFieldType(placeholder),
            required: true,
            placeholder: `Введите ${this.generateFieldLabel(placeholder).toLowerCase()}`,
            validation: {},
            occurrences: template.placeholders[placeholder]?.count || 1
        }));
    }

    generateFieldLabel(fieldName) {
        // Словарь для перевода
        const translations = {
            'name': 'Имя',
            'firstname': 'Имя',
            'lastname': 'Фамилия',
            'email': 'Email',
            'phone': 'Телефон',
            'date': 'Дата',
            'address': 'Адрес',
            'city': 'Город',
            'company': 'Компания',
            'position': 'Должность',
            'title': 'Заголовок',
            'description': 'Описание',
            'amount': 'Сумма',
            'price': 'Цена',
            'quantity': 'Количество'
        };
        
        const lower = fieldName.toLowerCase();
        if (translations[lower]) {
            return translations[lower];
        }
        
        // Форматируем название
        return fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    detectFieldType(fieldName) {
        const name = fieldName.toLowerCase();
        
        if (name.includes('email') || name.includes('mail')) return 'email';
        if (name.includes('phone') || name.includes('tel')) return 'tel';
        if (name.includes('date') || name.includes('дата')) return 'date';
        if (name.includes('url') || name.includes('website')) return 'url';
        if (name.includes('number') || name.includes('amount') || name.includes('price')) return 'number';
        if (name.includes('description') || name.includes('comment') || name.includes('text')) return 'textarea';
        
        return 'text';
    }

    // Демо-данные для fallback
    loadDemoTemplates() {
        console.log('📄 Загрузка демо-данных...');
        
        this.templates = {
            'demo_contract.pdf': {
                name: 'demo_contract.pdf',
                original_filename: 'Демо договор.pdf',
                id: 'demo_001',
                uploaded_at: new Date().toISOString(),
                file_size: 25600,
                placeholders: {
                    'name': { name: 'name', count: 2, positions: [100, 500] },
                    'date': { name: 'date', count: 1, positions: [200] },
                    'company': { name: 'company', count: 3, positions: [300, 400, 600] },
                    'email': { name: 'email', count: 1, positions: [700] }
                },
                form_fields: [
                    {
                        name: 'name',
                        label: 'Полное имя',
                        type: 'text',
                        required: true,
                        placeholder: 'Введите ваше полное имя',
                        occurrences: 2
                    },
                    {
                        name: 'email',
                        label: 'Email адрес',
                        type: 'email',
                        required: true,
                        placeholder: 'your@email.com',
                        validation: {
                            pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+',
                            message: 'Введите корректный email'
                        },
                        occurrences: 1
                    },
                    {
                        name: 'date',
                        label: 'Дата подписания',
                        type: 'date',
                        required: true,
                        placeholder: 'Выберите дату',
                        occurrences: 1
                    },
                    {
                        name: 'company',
                        label: 'Название компании',
                        type: 'text',
                        required: true,
                        placeholder: 'ООО "Рога и копыта"',
                        occurrences: 3
                    }
                ],
                stats: {
                    total_placeholders: 4,
                    total_occurrences: 7
                }
            },
            'demo_invoice.pdf': {
                name: 'demo_invoice.pdf',
                original_filename: 'Счет на оплату.pdf',
                id: 'demo_002',
                uploaded_at: new Date(Date.now() - 86400000).toISOString(), // вчера
                file_size: 18432,
                placeholders: {
                    'client_name': { name: 'client_name', count: 1, positions: [150] },
                    'amount': { name: 'amount', count: 2, positions: [250, 350] },
                    'invoice_number': { name: 'invoice_number', count: 1, positions: [50] }
                },
                form_fields: [
                    {
                        name: 'invoice_number',
                        label: 'Номер счета',
                        type: 'text',
                        required: true,
                        placeholder: 'INV-001',
                        occurrences: 1
                    },
                    {
                        name: 'client_name',
                        label: 'Клиент',
                        type: 'text',
                        required: true,
                        placeholder: 'Название клиента',
                        occurrences: 1
                    },
                    {
                        name: 'amount',
                        label: 'Сумма',
                        type: 'number',
                        required: true,
                        placeholder: '10000',
                        validation: {
                            min: 0,
                            message: 'Сумма должна быть положительной'
                        },
                        occurrences: 2
                    }
                ],
                stats: {
                    total_placeholders: 3,
                    total_occurrences: 4
                }
            }
        };
    }

    /**
     * ========================================
     * ДОПОЛНИТЕЛЬНЫЕ API МЕТОДЫ
     * ========================================
     */

    // Удаление шаблона
    async deleteTemplate(templateId) {
        try {
            const response = await fetch(`${this.apiBase}/template/${templateId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const result = await response.json();
                this.showToast('Шаблон удален', 'success');
                
                // Перезагружаем список
                await this.loadTemplates();
                this.renderTemplates();
                
                return result;
            }

        } catch (error) {
            console.error('❌ Ошибка удаления:', error);
            this.showToast('Ошибка удаления шаблона', 'error');
        }
    }

    // Пересканирование шаблонов
    async rescanTemplates() {
        try {
            this.showToast('Пересканирование шаблонов...', 'info');
            
            const response = await fetch(`${this.apiBase}/rescan_templates`, {
                method: 'POST'
            });

            if (response.ok) {
                const result = await response.json();
                this.showToast(`Обновлено шаблонов: ${result.total_templates}`, 'success');
                
                // Перезагружаем
                await this.loadTemplates();
                this.renderTemplates();
                
                return result;
            }

        } catch (error) {
            console.error('❌ Ошибка пересканирования:', error);
            this.showToast('Ошибка пересканирования', 'error');
        }
    }

    // Получение информации о конкретном шаблоне
    async getTemplateInfo(templateName) {
        try {
            const response = await fetch(`${this.apiBase}/template/${encodeURIComponent(templateName)}`);
            
            if (response.ok) {
                return await response.json();
            }

        } catch (error) {
            console.error('❌ Ошибка получения информации о шаблоне:', error);
        }
        
        return null;
    }

    /**
     * ========================================
     * ПРОДВИНУТЫЕ ФУНКЦИИ UI
     * ========================================
     */

    // Drag & Drop для загрузки файлов
    setupDragAndDrop(dropZoneElement) {
        if (!dropZoneElement) return;

        const dragEvents = ['dragenter', 'dragover', 'dragleave', 'drop'];
        
        dragEvents.forEach(eventName => {
            dropZoneElement.addEventListener(eventName, this.preventDefaults, false);
        });

        dropZoneElement.addEventListener('dragenter', () => this.highlight(dropZoneElement));
        dropZoneElement.addEventListener('dragover', () => this.highlight(dropZoneElement));
        dropZoneElement.addEventListener('dragleave', () => this.unhighlight(dropZoneElement));
        dropZoneElement.addEventListener('drop', (e) => {
            this.unhighlight(dropZoneElement);
            this.handleDrop(e);
        });
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    highlight(element) {
        element.classList.add('dragover');
    }

    unhighlight(element) {
        element.classList.remove('dragover');
    }

    async handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            const file = files[0];
            
            if (file.type === 'application/pdf') {
                await this.uploadTemplate(file, file.name);
            } else {
                this.showToast('Поддерживаются только PDF файлы', 'warning');
            }
        }
    }

    // Клавиатурные сокращения
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K для поиска
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.elements.searchInput?.focus();
            }
            
            // Ctrl/Cmd + U для загрузки
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                // Можно добавить модальное окно загрузки
            }
            
            // Ctrl/Cmd + R для обновления
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.loadTemplates().then(() => this.renderTemplates());
            }
        });
    }

    // Бесконечная прокрутка (если нужно для большого количества шаблонов)
    setupInfiniteScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Загрузить больше шаблонов
                    this.loadMoreTemplates();
                }
            });
        });

        // Наблюдаем за элементом в конце списка
        const sentinel = document.createElement('div');
        sentinel.style.height = '1px';
        this.elements.templatesGrid?.appendChild(sentinel);
        observer.observe(sentinel);
    }

    async loadMoreTemplates() {
        // Реализация пагинации если нужно
        console.log('🔄 Загрузка дополнительных шаблонов...');
    }

    /**
     * ========================================
     * МЕТОДЫ ДЛЯ ОТЛАДКИ И МОНИТОРИНГА
     * ========================================
     */

    // Логирование событий
    logEvent(eventName, data = {}) {
        const eventData = {
            timestamp: new Date().toISOString(),
            event: eventName,
            data: data,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.log('📊 Event:', eventData);
        
        // Можно отправлять аналитику
        // this.sendAnalytics(eventData);
    }

    // Проверка производительности
    measurePerformance(label, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        console.log(`⏱️ ${label}: ${(end - start).toFixed(2)}ms`);
        return result;
    }

    // Проверка здоровья API
    async healthCheck() {
        try {
            const response = await fetch(`${this.apiBase.replace('/api', '')}/health`);
            const health = await response.json();
            
            console.log('💊 Health Check:', health);
            return health;
            
        } catch (error) {
            console.error('❌ API недоступен:', error);
            return { status: 'error', message: error.message };
        }
    }

    // Получение информации о приложении
    async getAppInfo() {
        try {
            const response = await fetch(`${this.apiBase.replace('/api', '')}/info`);
            return await response.json();
        } catch (error) {
            console.error('❌ Ошибка получения информации:', error);
            return null;
        }
    }
}

/**
 * ========================================
 * ГЛОБАЛЬНЫЕ ФУНКЦИИ И ИНИЦИАЛИЗАЦИЯ
 * ========================================
 */

// Глобальная переменная для доступа к приложению
let app;

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🌟 Oky Docky загружается...');
    
    try {
        // Создаем экземпляр приложения
        app = new OkyDockyApp();
        
        // Глобальные обработчики
        window.app = app; // Для доступа из HTML
        
        // Обработка ошибок
        window.addEventListener('error', (e) => {
            console.error('💥 Глобальная ошибка:', e.error);
            app.showToast('Произошла ошибка. Обновите страницу.', 'error');
        });
        
        // Обработка неперехваченных промисов
        window.addEventListener('unhandledrejection', (e) => {
            console.error('💥 Неперехваченный промис:', e.reason);
            app.showToast('Ошибка сети. Проверьте соединение.', 'error');
        });
        
        console.log('🎉 Oky Docky полностью загружен!');
        
    } catch (error) {
        console.error('💥 Критическая ошибка инициализации:', error);
        
        // Показываем базовое сообщение об ошибке
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; font-family: Arial, sans-serif;">
                <h1 style="color: #ef4444; margin-bottom: 1rem;">😵 Ошибка загрузки</h1>
                <p style="color: #666; margin-bottom: 2rem;">Не удалось загрузить приложение</p>
                <button onclick="location.reload()" style="padding: 0.75rem 1.5rem; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    🔄 Обновить страницу
                </button>
            </div>
        `;
    }
});

// Функции для обратной совместимости с HTML
function generateDocument(formatType) {
    app?.generateDocument(formatType);
}

function closeGenerateModal() {
    app?.closeModal('generateModal');
}

function closeFormatModal() {
    app?.closeModal('formatModal');
}

function openGenerateForm(templateName) {
    app?.openGenerateForm(templateName);
}

function debugTemplate(templateName) {
    app?.debugTemplate(templateName);
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OkyDockyApp;
}

// Дополнительные утилиты
const Utils = {
    // Debounce для поиска
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle для скролла
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Копирование в буфер обмена
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Ошибка копирования:', err);
            return false;
        }
    },
    
    // Скачивание файла
    downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

console.log('📄 main.js загружен успешно!');
