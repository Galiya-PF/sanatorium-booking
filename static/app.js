const API_URL = '/api';
let currentApplicationId = null;

// Загрузка списка санаториев при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadSanatoriums();
    loadApplications();
    loadStats();
});

// Загрузка санаториев
async function loadSanatoriums() {
    try {
        const response = await fetch(`${API_URL}/sanatoriums`);
        const sanatoriums = await response.json();
        const select = document.getElementById('sanatorium');
        sanatoriums.forEach(s => {
            const option = document.createElement('option');
            option.value = s.name;
            option.textContent = s.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки санаториев:', error);
    }
}

// Обработка отправки формы
document.getElementById('applicationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        full_name: document.getElementById('full_name').value,
        sanatorium: document.getElementById('sanatorium').value,
        start_date: document.getElementById('start_date').value,
        days: parseInt(document.getElementById('days').value),
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        department: document.getElementById('department').value,
        vacation_schedule_confirmed: document.getElementById('vacation_schedule_confirmed').checked
    };
    
    try {
        const response = await fetch(`${API_URL}/applications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Заявка успешно отправлена! Ожидайте уведомление от администратора.', 'success');
            document.getElementById('applicationForm').reset();
            loadApplications();
            loadStats();
        } else {
            showAlert(result.error || 'Ошибка при отправке заявки', 'danger');
        }
    } catch (error) {
        showAlert('Ошибка соединения с сервером', 'danger');
    }
});

// Показать уведомление
function showAlert(message, type) {
    const alert = document.getElementById('formAlert');
    alert.className = `alert alert-${type} alert-custom`;
    alert.textContent = message;
    alert.classList.remove('d-none');
    
    setTimeout(() => {
        alert.classList.add('d-none');
    }, 5000);
}

// Загрузка заявок для админа
async function loadApplications() {
    try {
        const response = await fetch(`${API_URL}/applications`);
        const applications = await response.json();
        
        const tbody = document.getElementById('applicationsTable');
        
        if (applications.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Нет заявок</td></tr>';
            return;
        }
        
        tbody.innerHTML = applications.map(app => {
            const statusClass = `status-${app.status}`;
            const statusText = {
                'pending': 'Ожидает',
                'approved': 'Одобрено',
                'rejected': 'Отклонено'
            }[app.status];
            
            const date = new Date(app.start_date).toLocaleDateString('ru-RU');
            const createdDate = new Date(app.created_at).toLocaleDateString('ru-RU');
            
            return `
                <tr>
                    <td>${createdDate}</td>
                    <td>
                        <strong>${app.full_name}</strong><br>
                        <small class="text-muted">${app.email}</small>
                    </td>
                    <td>${app.sanatorium}</td>
                    <td>${date}</td>
                    <td>${app.days}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="openProcessModal(${app.id})">
                            Обработать
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
    }
}

// Загрузка статистики
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const stats = await response.json();
        
        const statsMap = {};
        stats.forEach(s => {
            statsMap[s.status] = s.count;
        });
        
        document.getElementById('pendingCount').textContent = statsMap['pending'] || 0;
        document.getElementById('approvedCount').textContent = statsMap['approved'] || 0;
        document.getElementById('rejectedCount').textContent = statsMap['rejected'] || 0;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Открыть модальное окно обработки заявки
async function openProcessModal(id) {
    currentApplicationId = id;
    
    try {
        const response = await fetch(`${API_URL}/applications/${id}`);
        const app = await response.json();
        
        const date = new Date(app.start_date).toLocaleDateString('ru-RU');
        
        document.getElementById('applicationDetails').innerHTML = `
            <p><strong>ФИО:</strong> ${app.full_name}</p>
            <p><strong>Санаторий:</strong> ${app.sanatorium}</p>
            <p><strong>Дата начала:</strong> ${date}</p>
            <p><strong>Количество дней:</strong> ${app.days}</p>
            <p><strong>Email:</strong> ${app.email}</p>
            <p><strong>Телефон:</strong> ${app.phone}</p>
            <p><strong>Отдел:</strong> ${app.department || '-'}</p>
            <p><strong>Текущий статус:</strong> ${app.status}</p>
        `;
        
        document.getElementById('newStatus').value = app.status;
        document.getElementById('adminComment').value = app.admin_comment || '';
        
        updateNotificationPreview(app);
        
        // Обновление превью при изменении статуса или комментария
        document.getElementById('newStatus').addEventListener('change', () => updateNotificationPreview(app));
        document.getElementById('adminComment').addEventListener('input', () => updateNotificationPreview(app));
        
        const modal = new bootstrap.Modal(document.getElementById('processModal'));
        modal.show();
    } catch (error) {
        console.error('Ошибка загрузки заявки:', error);
    }
}

// Обновление превью уведомления
function updateNotificationPreview(app) {
    const status = document.getElementById('newStatus').value;
    const comment = document.getElementById('adminComment').value;
    const firstName = app.full_name.split(' ')[0];
    const date = new Date(app.start_date).toLocaleDateString('ru-RU');
    
    let message = '';
    
    if (status === 'approved') {
        message = `Уважаемый ${firstName}! вам забронирована санаторно-курортное лечение в санаторий "${app.sanatorium}" с ${date} года на ${app.days} дней. Просим подойти в профсоюз за доверенностью`;
    } else if (status === 'rejected') {
        message = comment || `Уважаемый ${firstName}! К сожалению, невозможно забронировать санаторно-курортное лечение в санаторий "${app.sanatorium}" на указанные даты.`;
    } else {
        message = `Уважаемый ${firstName}! Ваша заявка на санаторно-курортное лечение в санаторий "${app.sanatorium}" находится на рассмотрении.`;
    }
    
    document.getElementById('notificationPreview').textContent = message;
}

// Обновление заявки
async function updateApplication() {
    const status = document.getElementById('newStatus').value;
    const adminComment = document.getElementById('adminComment').value;
    
    try {
        const response = await fetch(`${API_URL}/applications/${currentApplicationId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status, admin_comment: adminComment })
        });
        
        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('processModal'));
            modal.hide();
            
            loadApplications();
            loadStats();
            
            alert('Статус заявки обновлен! Уведомление отправлено работнику.');
        } else {
            const result = await response.json();
            alert(result.error || 'Ошибка при обновлении заявки');
        }
    } catch (error) {
        alert('Ошибка соединения с сервером');
    }
}
