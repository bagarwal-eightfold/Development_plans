document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('edit-btn');
    const doneBtn = document.getElementById('done-btn');
    const body = document.body;
    const sectionsContainer = document.getElementById('sections-container');
    const addSectionBtn = document.getElementById('add-section-btn');

    let sortableInstances = [];
    let subsectionSortableInstances = [];
    let sectionSortableInstance = null;

    // ===========================
    //  Full-screen Item Picker Modal
    // ===========================
    let currentTargetContainer = null;
    let currentModalType = '';
    let displayedCount = 0;
    let allItems = [];

    const placeholderData = {
        'Course': Array.from({ length: 10 }, (_, i) => ({
            title: `Test Course ${i + 1}`,
            provider: 'Mindtickle',
            skills: ['AI', 'ML'],
            timeline: '1 hour',
            cost: '—',
            difficulty: 'Intermediate',
            description: 'During this two-part series you\'ll become increasingly familiar with AI concepts, terminology and considerations.'
        })),
        'Task': [ { isCustom: true, title: 'Create custom task' }, ...Array.from({ length: 10 }, (_, i) => ({
            title: `Test Task ${i + 1}`,
            provider: 'Internal',
            skills: ['Productivity'],
            timeline: '30 min',
            cost: '—',
            difficulty: 'Easy',
            description: 'This is a placeholder description for a task.'
        })) ],
        'Project': Array.from({ length: 10 }, (_, i) => ({
            title: `Test Project ${i + 1}`,
            provider: 'Internal',
            skills: ['Collaboration'],
            timeline: '2 weeks',
            cost: '—',
            difficulty: 'Medium',
            description: 'Placeholder description for a project.'
        }))
    };

    // Ensure modal element exists (lazy-create)
    const ensureItemModal = () => {
        let modal = document.getElementById('item-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'item-modal';
        modal.className = 'item-modal';
        modal.innerHTML = `
            <div class="item-modal-content">
                <div class="item-modal-header">
                    <input type="text" id="item-search" placeholder="Find items" />
                    <select id="item-filter"><option value="">Skills</option></select>
                </div>
                <div class="item-modal-body">
                    <div class="item-grid" id="item-grid"></div>
                    <div class="item-detail" id="item-detail"><p>Select an item to see details.</p></div>
                </div>
                <div class="item-modal-footer">
                    <button class="load-more-btn" id="load-more-btn">Load More</button>
                </div>
                <button class="item-modal-close" id="item-modal-close">Close</button>
            </div>`;
        document.body.appendChild(modal);

        // Close handler
        modal.querySelector('#item-modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        return modal;
    };

    const createPlanCard = (type, item) => {
        const card = document.createElement('div');
        let iconClass = 'fas fa-clipboard-list';
        let cardTypeClass = '';
        if (type === 'Course') { iconClass = 'fas fa-book-open'; cardTypeClass = ' card-course'; }
        else if (type === 'Project') { iconClass = 'fas fa-ruler-combined'; cardTypeClass = ' card-project'; }

        card.className = `task-card${cardTypeClass}`;
        card.innerHTML = `
            <div class="task-card-image-area">
                <div class="task-tag"><i class="${iconClass}"></i> ${type}</div>
            </div>
            <div class="task-card-info"><h4>${item.title}</h4><span class="card-subtitle">${item.provider || ''}</span></div>
            <div class="task-card-footer">
                <button class="status-btn not-started">Not started <i class="fas fa-chevron-down"></i></button>
                <button class="remove-btn">Remove from section</button>
            </div>`;
        return card;
    };

    const renderItemDetail = (item, type) => {
        const detail = document.getElementById('item-detail');
        if (!detail) return;
        detail.innerHTML = `
            <div class="detail-header ${type.toLowerCase()}">
                <h3>${item.title}</h3>
                <p class="provider">${item.provider}</p>
            </div>
            <div class="metric-row">
                <div class="metric"><strong>Cost</strong><br>Not Provided</div>
                <div class="metric"><strong>Timeline</strong><br>${item.timeline || 'Not Provided'}</div>
                <div class="metric"><strong>Difficulty</strong><br>${item.difficulty || 'Not Provided'}</div>
            </div>
            <button class="detail-remove-btn ${type.toLowerCase()}" id="detail-add-btn">${currentTargetContainer && [...currentTargetContainer.querySelectorAll('.task-card h4')].some(h=>h.textContent.trim()===item.title)?'Remove from section':'Add to section'}</button>
            <h4 style="margin-top:24px;">Skills you will learn</h4>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;">${item.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}</div>
            <h4>About this ${type.toLowerCase()}</h4>
            <p>${item.description}</p>`;

        const addBtn = detail.querySelector('#detail-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                if (!currentTargetContainer) return;
                const addCard = currentTargetContainer.querySelector('.add-item-card');
                const planCard = createPlanCard(type, item);
                currentTargetContainer.insertBefore(planCard, addCard);
                keepAddItemCardLast(currentTargetContainer);
                updateAllTaskCounts();
            });
        }
    };

    const renderModalGrid = (data, type) => {
        const grid = document.getElementById('item-grid');
        grid.innerHTML = '';

        data.forEach((item, idx) => {
            let cardEl;

            if (type === 'Task' && item.isCustom) {
                // Blank create-your-own card
                cardEl = document.createElement('div');
                cardEl.className = 'item-card blank-card';
                cardEl.innerHTML = '<span>➕ Create your own task</span>';
                cardEl.addEventListener('click', () => {
                    renderCustomTaskForm();
                });
                // first task shows details by default
                if (idx === 0) renderCustomTaskForm();
            } else {
                // Use existing task-card markup for preview consistency
                cardEl = createPlanCard(type, item);
                cardEl.classList.add('item-card'); // inherit grid sizing

                // Strip status & builtin remove buttons for clean preview
                const footer = cardEl.querySelector('.task-card-footer');
                if (footer) footer.innerHTML = '';

                let actionBtn = document.createElement('button');
                actionBtn.className = 'section-btn';
                actionBtn.textContent = 'Add to section';
                footer.appendChild(actionBtn);

                cardEl.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    renderItemDetail(item, type);
                });

                actionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!currentTargetContainer) return;

                    if (actionBtn.classList.contains('remove')) {
                        // remove existing
                        const cardList = currentTargetContainer.querySelectorAll('.task-card');
                        for (let c of cardList) {
                            const title = c.querySelector('h4')?.textContent.trim();
                            if (title === item.title) {
                                c.remove();
                                break;
                            }
                        }
                        updateAllTaskCounts();
                        actionBtn.textContent = 'Add to section';
                        actionBtn.classList.remove('remove');
                    } else {
                        const addCard = currentTargetContainer.querySelector('.add-item-card');
                        const planCard = createPlanCard(type, item);
                        currentTargetContainer.insertBefore(planCard, addCard);
                        keepAddItemCardLast(currentTargetContainer);
                        updateAllTaskCounts();
                        actionBtn.textContent = 'Remove from section';
                        actionBtn.classList.add('remove');
                    }
                });

                if (idx === 0) renderItemDetail(item, type);
            }

            grid.appendChild(cardEl);
        });
    };

    const appendToGrid = (data, type) => {
        const grid = document.getElementById('item-grid');
        data.forEach((item, idx) => {
            let cardEl;

            if (type === 'Task' && item.isCustom) {
                // Skip custom task card on load more
                return;
            } else {
                // Use existing task-card markup for preview consistency
                cardEl = createPlanCard(type, item);
                cardEl.classList.add('item-card'); // inherit grid sizing

                // Strip status & builtin remove buttons for clean preview
                const footer = cardEl.querySelector('.task-card-footer');
                if (footer) footer.innerHTML = '';

                let actionBtn = document.createElement('button');
                actionBtn.className = 'section-btn';
                actionBtn.textContent = 'Add to section';
                footer.appendChild(actionBtn);

                cardEl.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    renderItemDetail(item, type);
                });

                actionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!currentTargetContainer) return;

                    if (actionBtn.classList.contains('remove')) {
                        // remove existing
                        const cardList = currentTargetContainer.querySelectorAll('.task-card');
                        for (let c of cardList) {
                            const title = c.querySelector('h4')?.textContent.trim();
                            if (title === item.title) {
                                c.remove();
                                break;
                            }
                        }
                        updateAllTaskCounts();
                        actionBtn.textContent = 'Add to section';
                        actionBtn.classList.remove('remove');
                    } else {
                        const addCard = currentTargetContainer.querySelector('.add-item-card');
                        const planCard = createPlanCard(type, item);
                        currentTargetContainer.insertBefore(planCard, addCard);
                        keepAddItemCardLast(currentTargetContainer);
                        updateAllTaskCounts();
                        actionBtn.textContent = 'Remove from section';
                        actionBtn.classList.add('remove');
                    }
                });
            }

            grid.appendChild(cardEl);
        });
    };

    const renderCustomTaskForm = () => {
        const detail = document.getElementById('item-detail');
        if (!detail) return;
        detail.innerHTML = `
            <h3>Create a task</h3>
            <label>Title *</label>
            <input type="text" id="custom-task-title" placeholder="Task title" />
            <label>Description *</label>
            <textarea id="custom-task-desc" placeholder="Task Description"></textarea>
            <label>Skills covered</label>
            <select id="custom-task-skills">
                <option value="">Type or select from the list</option>
            </select>
            <label>Supporting attachments</label>
            <div class="attachment-drop">
                <p>📁 Drag & drop files<br><span style="font-size:12px;">Files less than 5MB</span></p>
                <button class="section-btn" style="margin-top:12px;">Select files</button>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:16px;">
                <button id="custom-task-cancel" class="section-btn" style="background:#ffffff;border:1px solid #007A8D;color:#007A8D;">Cancel</button>
                <button id="custom-task-save" class="section-btn">Save</button>
            </div>`;

        detail.querySelector('#custom-task-save').addEventListener('click', () => {
            const title = detail.querySelector('#custom-task-title').value.trim();
            const desc = detail.querySelector('#custom-task-desc').value.trim();
            if (!title || !desc) { alert('Please enter title and description'); return; }

            const item = { title: title, provider: '', skills: [], timeline: '', difficulty: '', description: desc };
            if (!currentTargetContainer) return;
            const addCard = currentTargetContainer.querySelector('.add-item-card');
            const planCard = createPlanCard('Task', item);
            // add description as subtitle
            planCard.querySelector('.card-subtitle').textContent = desc.substring(0,60);
            currentTargetContainer.insertBefore(planCard, addCard);
            keepAddItemCardLast(currentTargetContainer);
            updateAllTaskCounts();

            // Optionally reset form
            detail.innerHTML = '<p>Task added successfully!</p>';
        });

        detail.querySelector('#custom-task-cancel').addEventListener('click', () => {
            detail.innerHTML = '<p>Select an item to see details.</p>';
        });
    };

    const openItemModal = (type, targetContainer) => {
        currentTargetContainer = targetContainer;
        currentModalType = type;
        displayedCount = 0;
        allItems = [];

        const modal = ensureItemModal();
        modal.classList.add('active');

        const searchInput = modal.querySelector('#item-search');
        const loadMoreBtn = modal.querySelector('#load-more-btn');
        
        const loadData = () => {
            const query = searchInput.value.toLowerCase();
            allItems = placeholderData[type].filter(item => item.title.toLowerCase().includes(query));
            displayedCount = Math.min(allItems.length, 8); // Show first 8 items
            renderModalGrid(allItems.slice(0, displayedCount), type);
            // Reset detail panel
            document.getElementById('item-detail').innerHTML = '<p>Select an item to see details.</p>';
            // Show/hide Load More button
            loadMoreBtn.style.display = displayedCount < allItems.length ? 'block' : 'none';
        };

        const loadMore = () => {
            const nextBatch = Math.min(allItems.length - displayedCount, 5); // Load 5 more
            if (nextBatch > 0) {
                const newItems = allItems.slice(displayedCount, displayedCount + nextBatch);
                displayedCount += nextBatch;
                appendToGrid(newItems, type);
                loadMoreBtn.style.display = displayedCount < allItems.length ? 'block' : 'none';
            }
        };

        loadMoreBtn.onclick = loadMore;
        searchInput.value = '';
        searchInput.oninput = loadData;
        loadData();
    };
    // ===========================
    //  End modal code
    // ===========================

    // Function to update task counts for all sections
    const updateAllTaskCounts = () => {
        document.querySelectorAll('.tasks-section').forEach(section => {
            const taskCards = section.querySelectorAll('.task-card:not(.card-course):not(.card-project)');
            const taskCountElement = section.querySelector('.task-count');
            if (taskCountElement) {
                taskCountElement.textContent = taskCards.length;
            }
            // Handle empty-tasks message
            let msg = section.querySelector('.empty-tasks-message');
            if (!msg) {
                const infoBar = section.querySelector('.section-info-bar');
                if (infoBar) {
                    msg = document.createElement('p');
                    msg.className = 'empty-tasks-message';
                    msg.innerHTML = `<button class="empty-add-btn"><i class="fas fa-plus"></i></button> Adding tasks keeps you 2× more engaged. Start with your first one! 🚀`;
                    infoBar.appendChild(msg);

                    // Attach click handler to plus button
                    const plusBtn = msg.querySelector('.empty-add-btn');
                    if (plusBtn) {
                        plusBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const container = section.querySelector('.task-cards-container');
                            if (container) {
                                openItemModal('Task', container);
                            }
                        });
                    }
                }
            }
            if (msg) {
                const inEdit = body.classList.contains('edit-mode');
                const showMsg = !inEdit && taskCards.length === 0;
                msg.style.display = showMsg ? 'block' : 'none';

                // infoBar layout remains constant via CSS
            }
        });
    };

    // Improved ordering function for sections/subsections
    const orderSections = (container) => {
        const sections = Array.from(container.children).filter(child => 
            child.classList.contains('tasks-section') || child.classList.contains('subsection')
        );
        
        sections.sort((a, b) => {
            const aDeadline = a.querySelector('.deadline-btn')?.dataset.deadline;
            const bDeadline = b.querySelector('.deadline-btn')?.dataset.deadline;
            const aPriority = a.querySelector('.priority-btn')?.dataset.priority || '';
            const bPriority = b.querySelector('.priority-btn')?.dataset.priority || '';
            
            // First sort by deadline (overdue first, then by days left)
            if (aDeadline && bDeadline) {
                const aDate = new Date(aDeadline);
                const bDate = new Date(bDeadline);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                aDate.setHours(0, 0, 0, 0);
                bDate.setHours(0, 0, 0, 0);
                
                const aDiff = aDate - today;
                const bDiff = bDate - today;
                
                // Both overdue - sort by most overdue first
                if (aDiff < 0 && bDiff < 0) {
                    return aDiff - bDiff; // More negative first
                }
                // One overdue, one not - overdue first
                if (aDiff < 0 && bDiff >= 0) return -1;
                if (aDiff >= 0 && bDiff < 0) return 1;
                // Both future - sort by soonest first
                return aDiff - bDiff;
            }
            
            // One has deadline, one doesn't - deadline first
            if (aDeadline && !bDeadline) return -1;
            if (!aDeadline && bDeadline) return 1;
            
            // Neither has deadline, sort by priority (high -> medium -> low -> no priority)
            const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2, '': 3 };
            const aPriorityValue = priorityOrder[aPriority] !== undefined ? priorityOrder[aPriority] : 3;
            const bPriorityValue = priorityOrder[bPriority] !== undefined ? priorityOrder[bPriority] : 3;
            
            return aPriorityValue - bPriorityValue;
        });
        
        // Reorder in DOM
        sections.forEach(section => container.appendChild(section));
    };

    const initializeSubsection = (subsection) => {
        const cardsContainer = subsection.querySelector('.task-cards-container');
        const addItemCard = subsection.querySelector('.add-item-card');
        const addItemBtn = subsection.querySelector('.add-item-btn');
        const popup = subsection.querySelector('.add-item-popup');
        const priorityBtn = subsection.querySelector('.priority-btn');
        const deadlineBtn = subsection.querySelector('.deadline-btn');
        const priorityPopup = subsection.querySelector('.priority-popup');
        const deadlinePopup = subsection.querySelector('.deadline-popup');
        const deadlinePicker = subsection.querySelector('.deadline-picker');
        const durationNumber = subsection.querySelector('.duration-number');
        const durationUnit = subsection.querySelector('.duration-unit');
        const durationApplyBtn = subsection.querySelector('.duration-apply-btn');
        const deadlineReset = subsection.querySelector('.deadline-reset');

        // Ensure only one add item card exists
        const existingAddCards = cardsContainer.querySelectorAll('.add-item-card');
        if (existingAddCards.length > 1) {
            for (let i = 1; i < existingAddCards.length; i++) {
                existingAddCards[i].remove();
            }
        }

        // Initialize sortable for subsection cards
        if (cardsContainer) {
            const sortableInstance = new Sortable(cardsContainer, {
                group: 'shared',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                draggable: '.task-card',
                disabled: !body.classList.contains('edit-mode'),
                emptyInsertThreshold: 5,
                onEnd: function (evt) {
                    updateAllTaskCounts();
                    keepAddItemCardLast(cardsContainer);
                },
                onAdd: function(evt){
                    keepAddItemCardLast(cardsContainer);
                }
            });
            subsectionSortableInstances.push(sortableInstance);
            
            // If we're currently in edit mode, ensure this sortable is enabled
            if (body.classList.contains('edit-mode')) {
                sortableInstance.option('disabled', false);
            }
        }

        // Initialize all the same functionality as sections
        if (addItemBtn) {
            addItemBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addItemCard.classList.toggle('popup-active');
            });
        }

        // Add Cards functionality
        const createCard = (type, title) => {
            const card = document.createElement('div');
            let iconClass = 'fas fa-clipboard-list';
            let cardTypeClass = '';
            if(type === 'Course') { iconClass = 'fas fa-book-open'; cardTypeClass = ' card-course'; } 
            else if (type === 'Project') { iconClass = 'fas fa-ruler-combined'; cardTypeClass = ' card-project'; }
            card.className = `task-card${cardTypeClass}`;
            card.innerHTML = `
                <div class="task-card-image-area">
                    <div class="task-tag"><i class="${iconClass}"></i> ${type}</div>
                </div>
                <div class="task-card-info"><h4>${title}</h4><span class="card-subtitle"></span></div>
                <div class="task-card-footer">
                    <button class="status-btn not-started">Not started <i class="fas fa-chevron-down"></i></button>
                    <button class="remove-btn">Remove from section</button>
                </div>`;
            return card;
        };
        
        if (popup) {
            const courseBtn = popup.querySelector('.popup-course');
            const taskBtn = popup.querySelector('.popup-task');
            const projectBtn = popup.querySelector('.popup-project');
            
            if (courseBtn) {
                courseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addItemCard.classList.remove('popup-active');
                    openItemModal('Course', cardsContainer);
                });
            }
            if (taskBtn) {
                taskBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addItemCard.classList.remove('popup-active');
                    openItemModal('Task', cardsContainer);
                });
            }
            if (projectBtn) {
                projectBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addItemCard.classList.remove('popup-active');
                    openItemModal('Project', cardsContainer);
                });
            }
        }

        // Priority and deadline functionality (same as sections)
        if (priorityBtn) {
            priorityBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                priorityBtn.classList.toggle('active');
                if (deadlineBtn) deadlineBtn.classList.remove('active');
            });
        }

        if (priorityPopup) {
            priorityPopup.addEventListener('click', (e) => {
                const option = e.target.closest('.priority-option');
                if (option) {
                    const priority = option.dataset.priority;
                    
                    if (priority === '') {
                        priorityBtn.innerHTML = '<i class="fas fa-flag"></i> Set Priority';
                        priorityBtn.dataset.priority = '';
                    } else {
                        const priorityText = option.textContent.trim();
                        const priorityIcon = option.querySelector('.priority-dot').cloneNode(true);
                        
                        priorityBtn.innerHTML = '';
                        priorityBtn.appendChild(priorityIcon);
                        priorityBtn.appendChild(document.createTextNode(' ' + priorityText));
                        priorityBtn.dataset.priority = priority;
                    }
                    
                    priorityBtn.classList.remove('active');
                    
                    // Reorder subsections after priority change
                    const section = subsection.closest('.tasks-section');
                    const subsectionsContainer = section.querySelector('.subsections-container');
                    orderSections(subsectionsContainer);
                }
            });
        }

        if (deadlineBtn) {
            deadlineBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deadlineBtn.classList.toggle('active');
                if (priorityBtn) priorityBtn.classList.remove('active');
            });
        }

        // Deadline tab switching
        subsection.querySelectorAll('.deadline-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabType = tab.dataset.tab;
                
                subsection.querySelectorAll('.deadline-tab').forEach(t => t.classList.remove('active'));
                subsection.querySelectorAll('.deadline-tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                subsection.querySelector(`[data-content="${tabType}"]`).classList.add('active');
            });
        });

        // Helper function to update deadline button
        const updateDeadlineButton = (dateValue) => {
            const selectedDate = new Date(dateValue);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            selectedDate.setHours(0, 0, 0, 0);
            
            const diffTime = selectedDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let buttonText, icon;
            if (diffDays > 0) {
                buttonText = `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
                icon = '📅';
            } else if (diffDays < 0) {
                buttonText = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
                icon = '⚠️';
            } else {
                buttonText = 'Due today';
                icon = '📅';
            }
            
            deadlineBtn.innerHTML = `${icon} ${buttonText}`;
            deadlineBtn.dataset.deadline = dateValue;
            deadlineBtn.classList.remove('active');
            
            // Reorder subsections after deadline change
            const section = subsection.closest('.tasks-section');
            const subsectionsContainer = section.querySelector('.subsections-container');
            orderSections(subsectionsContainer);
        };

        if (deadlinePicker) {
            deadlinePicker.addEventListener('change', (e) => {
                if (e.target.value) {
                    updateDeadlineButton(e.target.value);
                }
            });
        }

        if (durationApplyBtn) {
            durationApplyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const number = parseInt(durationNumber.value);
                const unit = durationUnit.value;
                
                if (number && number > 0) {
                    const today = new Date();
                    let targetDate = new Date(today);
                    
                    switch (unit) {
                        case 'days':
                            targetDate.setDate(today.getDate() + number);
                            break;
                        case 'weeks':
                            targetDate.setDate(today.getDate() + (number * 7));
                            break;
                        case 'months':
                            targetDate.setMonth(today.getMonth() + number);
                            break;
                    }
                    
                    const dateString = targetDate.toISOString().split('T')[0];
                    updateDeadlineButton(dateString);
                    
                    durationNumber.value = '';
                }
            });
        }

        if (deadlineReset) {
            deadlineReset.addEventListener('click', (e) => {
                e.stopPropagation();
                deadlineBtn.innerHTML = '<i class="fas fa-calendar-alt"></i> Set Deadline';
                deadlineBtn.dataset.deadline = '';
                deadlineBtn.classList.remove('active');
                
                if (deadlinePicker) deadlinePicker.value = '';
                if (durationNumber) durationNumber.value = '';
                
                // Reorder subsections after deadline reset
                const section = subsection.closest('.tasks-section');
                const subsectionsContainer = section.querySelector('.subsections-container');
                orderSections(subsectionsContainer);
            });
        }

        // Subsection collapse/expand
        const toggle = subsection.querySelector('.subsection-toggle');
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isCollapsed = subsection.dataset.collapsed === 'true';
                subsection.dataset.collapsed = !isCollapsed;
            });
        }
    };

    const initializeSection = (section) => {
        const cardsContainer = section.querySelector('.task-cards-container');
        const addItemCard = section.querySelector('.add-item-card');
        const addItemBtn = section.querySelector('.add-item-btn');
        const popup = section.querySelector('.add-item-popup');
        const subsectionsContainer = section.querySelector('.subsections-container');
        const addSubsectionBtn = section.querySelector('.add-subsection-btn');
        
        console.log('Initializing section:', section);
        console.log('Cards container:', cardsContainer);
        console.log('Add item card:', addItemCard);
        
        // Ensure only one add item card exists
        const existingAddCards = cardsContainer.querySelectorAll('.add-item-card');
        if (existingAddCards.length > 1) {
            for (let i = 1; i < existingAddCards.length; i++) {
                existingAddCards[i].remove();
            }
        }
        
        // Initialize priority and deadline buttons
        const priorityBtn = section.querySelector('.priority-btn');
        const priorityPopup = section.querySelector('.priority-popup');
        const deadlineBtn = section.querySelector('.deadline-btn');
        const deadlinePopup = section.querySelector('.deadline-popup');
        const deadlinePicker = section.querySelector('.deadline-picker');
        const durationNumber = section.querySelector('.duration-number');
        const durationUnit = section.querySelector('.duration-unit');
        const durationApplyBtn = section.querySelector('.duration-apply-btn');
        const deadlineReset = section.querySelector('.deadline-reset');

        // Initialize sortable for main section cards
        if (cardsContainer) {
            const sortable = new Sortable(cardsContainer, {
                group: 'shared',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                draggable: '.task-card',
                disabled: !body.classList.contains('edit-mode'),
                emptyInsertThreshold: 5,
                onEnd: function (evt) {
                    updateAllTaskCounts();
                    keepAddItemCardLast(cardsContainer);
                },
                onAdd: function(evt){
                    keepAddItemCardLast(cardsContainer);
                }
            });
            sortableInstances.push(sortable);
            
            // If we're currently in edit mode, ensure this sortable is enabled
            if (body.classList.contains('edit-mode')) {
                sortable.option('disabled', false);
            }
        }

        // Init Sortable for subsections
        if (subsectionsContainer) {
            const subsectionSortable = new Sortable(subsectionsContainer, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                disabled: !body.classList.contains('edit-mode'),
                handle: '.subsection-header',
                onEnd: function (evt) {
                    // Subsection reordered
                }
            });
            subsectionSortableInstances.push(subsectionSortable);
            
            // If we're currently in edit mode, ensure this sortable is enabled
            if (body.classList.contains('edit-mode')) {
                subsectionSortable.option('disabled', false);
            }
        }
        
        // Add Item functionality
        if (addItemBtn) {
            addItemBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addItemCard.classList.toggle('popup-active');
            });
        }

        // Add Cards
        const createCard = (type, title) => {
            const card = document.createElement('div');
            let iconClass = 'fas fa-clipboard-list';
            let cardTypeClass = '';
            if(type === 'Course') { iconClass = 'fas fa-book-open'; cardTypeClass = ' card-course'; } 
            else if (type === 'Project') { iconClass = 'fas fa-ruler-combined'; cardTypeClass = ' card-project'; }
            card.className = `task-card${cardTypeClass}`;
            card.innerHTML = `
                <div class="task-card-image-area">
                    <div class="task-tag"><i class="${iconClass}"></i> ${type}</div>
                </div>
                <div class="task-card-info"><h4>${title}</h4><span class="card-subtitle"></span></div>
                <div class="task-card-footer">
                    <button class="status-btn not-started">Not started <i class="fas fa-chevron-down"></i></button>
                    <button class="remove-btn">Remove from section</button>
                </div>`;
            return card;
        };
        
        if (popup) {
            const courseBtn = popup.querySelector('.popup-course');
            const taskBtn = popup.querySelector('.popup-task');
            const projectBtn = popup.querySelector('.popup-project');
            
            if (courseBtn) {
                courseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addItemCard.classList.remove('popup-active');
                    openItemModal('Course', cardsContainer);
                });
            }
            if (taskBtn) {
                taskBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addItemCard.classList.remove('popup-active');
                    openItemModal('Task', cardsContainer);
                });
            }
            if (projectBtn) {
                projectBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addItemCard.classList.remove('popup-active');
                    openItemModal('Project', cardsContainer);
                });
            }
        }

        // Priority button functionality
        if (priorityBtn) {
            priorityBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                priorityBtn.classList.toggle('active');
                // Close deadline popup if open
                if (deadlineBtn) deadlineBtn.classList.remove('active');
            });
        }

        // Priority option selection
        if (priorityPopup) {
            priorityPopup.addEventListener('click', (e) => {
                const option = e.target.closest('.priority-option');
                if (option) {
                    const priority = option.dataset.priority;
                    
                    if (priority === '') {
                        // Reset priority
                        priorityBtn.innerHTML = '<i class="fas fa-flag"></i> Set Priority';
                        priorityBtn.dataset.priority = '';
                    } else {
                        // Set priority
                        const priorityText = option.textContent.trim();
                        const priorityIcon = option.querySelector('.priority-dot').cloneNode(true);
                        
                        priorityBtn.innerHTML = '';
                        priorityBtn.appendChild(priorityIcon);
                        priorityBtn.appendChild(document.createTextNode(' ' + priorityText));
                        priorityBtn.dataset.priority = priority;
                    }
                    
                    priorityBtn.classList.remove('active');
                    
                    // Reorder sections after priority change
                    orderSections(sectionsContainer);
                }
            });
        }

        // Deadline button functionality
        if (deadlineBtn) {
            deadlineBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deadlineBtn.classList.toggle('active');
                // Close priority popup if open
                if (priorityBtn) priorityBtn.classList.remove('active');
            });
        }

        // Deadline tab switching
        section.querySelectorAll('.deadline-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabType = tab.dataset.tab;
                
                // Update tab active states
                section.querySelectorAll('.deadline-tab').forEach(t => t.classList.remove('active'));
                section.querySelectorAll('.deadline-tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                section.querySelector(`[data-content="${tabType}"]`).classList.add('active');
            });
        });

        // Helper function to update deadline button
        const updateDeadlineButton = (dateValue) => {
            const selectedDate = new Date(dateValue);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            selectedDate.setHours(0, 0, 0, 0);
            
            const diffTime = selectedDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let buttonText, icon;
            if (diffDays > 0) {
                buttonText = `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
                icon = '📅';
            } else if (diffDays < 0) {
                buttonText = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
                icon = '⚠️';
            } else {
                buttonText = 'Due today';
                icon = '📅';
            }
            
            deadlineBtn.innerHTML = `${icon} ${buttonText}`;
            deadlineBtn.dataset.deadline = dateValue;
            deadlineBtn.classList.remove('active');
            
            // Reorder sections after deadline change
            orderSections(sectionsContainer);
        };

        // Deadline picker functionality
        if (deadlinePicker) {
            deadlinePicker.addEventListener('change', (e) => {
                if (e.target.value) {
                    updateDeadlineButton(e.target.value);
                }
            });
        }

        // Duration apply functionality
        if (durationApplyBtn) {
            durationApplyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const number = parseInt(durationNumber.value);
                const unit = durationUnit.value;
                
                if (number && number > 0) {
                    const today = new Date();
                    let targetDate = new Date(today);
                    
                    switch (unit) {
                        case 'days':
                            targetDate.setDate(today.getDate() + number);
                            break;
                        case 'weeks':
                            targetDate.setDate(today.getDate() + (number * 7));
                            break;
                        case 'months':
                            targetDate.setMonth(today.getMonth() + number);
                            break;
                    }
                    
                    const dateString = targetDate.toISOString().split('T')[0];
                    updateDeadlineButton(dateString);
                    
                    // Clear the inputs
                    durationNumber.value = '';
                }
            });
        }

        // Add Subsection functionality
        if (addSubsectionBtn) {
            addSubsectionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newSubsection = document.createElement('div');
                newSubsection.className = 'subsection';
                newSubsection.dataset.collapsed = 'false';
                newSubsection.innerHTML = `
                    <div class="subsection-header">
                        <div class="subsection-title">
                            <label>Subsection name</label>
                            <input type="text" value="Untitled Subsection">
                        </div>
                        <div class="subsection-controls">
                            <div class="priority-container">
                                <button class="priority-btn section-btn" data-priority="">
                                    <i class="fas fa-flag"></i> Set Priority
                                </button>
                                <div class="priority-popup">
                                    <button class="priority-option" data-priority="high">
                                        <span class="priority-dot high"></span> High Priority
                                    </button>
                                    <button class="priority-option" data-priority="medium">
                                        <span class="priority-dot medium"></span> Medium Priority
                                    </button>
                                    <button class="priority-option" data-priority="low">
                                        <span class="priority-dot low"></span> Low Priority
                                    </button>
                                    <button class="priority-option priority-reset" data-priority="">
                                        <i class="fas fa-undo"></i> Reset Priority
                                    </button>
                                </div>
                            </div>
                            <div class="deadline-container">
                                <button class="deadline-btn section-btn" data-deadline="">
                                    <i class="fas fa-calendar-alt"></i> Set Deadline
                                </button>
                                <div class="deadline-popup">
                                    <div class="deadline-tabs">
                                        <button class="deadline-tab active" data-tab="date">
                                            <i class="fas fa-calendar-alt"></i> Pick a Date
                                        </button>
                                        <button class="deadline-tab" data-tab="duration">
                                            <i class="fas fa-clock"></i> Enter Duration
                                        </button>
                                    </div>
                                    <div class="deadline-content">
                                        <div class="deadline-tab-content active" data-content="date">
                                            <input type="date" class="deadline-picker">
                                        </div>
                                        <div class="deadline-tab-content" data-content="duration">
                                            <div class="duration-input-row">
                                                <input type="number" class="duration-number" min="1" placeholder="5">
                                                <select class="duration-unit">
                                                    <option value="days">days</option>
                                                    <option value="weeks">weeks</option>
                                                    <option value="months">months</option>
                                                </select>
                                            </div>
                                            <button class="duration-apply-btn">Apply Duration</button>
                                        </div>
                                    </div>
                                    <button class="deadline-reset" data-deadline="">
                                        <i class="fas fa-undo"></i> Reset Deadline
                                    </button>
                                </div>
                            </div>
                            <button class="subsection-toggle">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div class="more-options-menu-container">
                                <i class="fas fa-ellipsis-h more-options-trigger"></i>
                                <div class="delete-popup">
                                    <button class="delete-subsection-btn"><i class="fas fa-trash-alt"></i> Delete</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="subsection-content">
                        <div class="task-cards-container">
                            <div class="add-item-card">
                                <div class="add-item-popup">
                                    <div class="popup-item popup-course"><i class="fas fa-book-open"></i> <div class="popup-item-text"><strong>Course</strong><span>Courses are perfect to kickoff the Development plan for anyone at any point in their career paths.</span></div></div>
                                    <div class="popup-item popup-task"><i class="fas fa-clipboard-list"></i> <div class="popup-item-text"><strong>Task</strong><span>Use this to build anything you want to be a part of the plan.</span></div></div>
                                    <div class="popup-item popup-project"><i class="fas fa-ruler-combined"></i> <div class="popup-item-text"><strong>Project</strong><span>Working on projects where the targeted role is required give employees the best hands-on experience.</span></div></div>
                                </div>
                                <p>Explore different learning materials for the skills in your plan</p>
                                <button class="add-item-btn">Add an Item <i class="fas fa-chevron-down"></i></button>
                            </div>
                        </div>
                    </div>`;
                subsectionsContainer.appendChild(newSubsection);
                initializeSubsection(newSubsection);
            });
        }

        // Initialize existing subsections
        section.querySelectorAll('.subsection').forEach(subsection => {
            initializeSubsection(subsection);
        });

        // Deadline reset functionality
        if (deadlineReset) {
            deadlineReset.addEventListener('click', (e) => {
                e.stopPropagation();
                deadlineBtn.innerHTML = '<i class="fas fa-calendar-alt"></i> Set Deadline';
                deadlineBtn.dataset.deadline = '';
                deadlineBtn.classList.remove('active');
                
                // Clear inputs
                if (deadlinePicker) deadlinePicker.value = '';
                if (durationNumber) durationNumber.value = '';
                
                // Reorder sections after deadline reset
                orderSections(sectionsContainer);
            });
        }

        // Section collapse/expand functionality
        const sectionToggle = section.querySelector('.tasks-header i.fa-chevron-up, .tasks-header i.fa-chevron-down');
        if (sectionToggle) {
            sectionToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isCollapsed = section.dataset.collapsed === 'true';
                section.dataset.collapsed = !isCollapsed;
                
                // Update chevron direction
                if (isCollapsed) {
                    sectionToggle.className = 'fas fa-chevron-up';
                } else {
                    sectionToggle.className = 'fas fa-chevron-down';
                }
            });
        }
    };

    // Global click handlers
    document.addEventListener('click', (e) => {
        // Close popups
        document.querySelectorAll('.add-item-card.popup-active').forEach(card => {
            if (!card.contains(e.target)) {
                card.classList.remove('popup-active');
            }
        });
        
        // Close priority and deadline popups
        document.querySelectorAll('.priority-btn.active').forEach(btn => {
            const container = btn.closest('.priority-container');
            if (container && !container.contains(e.target)) {
                btn.classList.remove('active');
            }
        });
        
        document.querySelectorAll('.deadline-btn.active').forEach(btn => {
            const container = btn.closest('.deadline-container');
            if (container && !container.contains(e.target)) {
                btn.classList.remove('active');
            }
        });
        
        // Handle three-dot delete menu
        const trigger = e.target.closest('.more-options-trigger');
        document.querySelectorAll('.more-options-menu-container.active').forEach(menu => {
            if (!menu.contains(e.target)) {
                menu.classList.remove('active');
            }
        });
        if (trigger) {
            trigger.closest('.more-options-menu-container').classList.toggle('active');
        }

        // Remove cards
        if (e.target.classList.contains('remove-btn')) {
            const card = e.target.closest('.task-card');
            if (card) {
                card.remove();
                updateAllTaskCounts();
            }
        }

        // Remove sections
        if (e.target.closest('.delete-section-btn')) {
            const section = e.target.closest('.tasks-section');
            if (section) section.remove();
        }

        // Remove subsections
        if (e.target.closest('.delete-subsection-btn')) {
            const subsection = e.target.closest('.subsection');
            if (subsection) subsection.remove();
        }
    });

    // Edit/Done mode
    if (editBtn && doneBtn && body) {
        editBtn.addEventListener('click', () => {
            body.classList.add('edit-mode');
            sortableInstances.forEach(s => s.option('disabled', false));
            subsectionSortableInstances.forEach(s => s.option('disabled', false));
            if (sectionSortableInstance) sectionSortableInstance.option('disabled', false);
        });

        doneBtn.addEventListener('click', () => {
            body.classList.remove('edit-mode');
            sortableInstances.forEach(s => s.option('disabled', true));
            subsectionSortableInstances.forEach(s => s.option('disabled', true));
            if (sectionSortableInstance) sectionSortableInstance.option('disabled', true);
            // Ensure task counts & empty-state messages are refreshed when leaving edit mode
            updateAllTaskCounts();
        });
    }

    // Add new section
    if (addSectionBtn && sectionsContainer) {
        addSectionBtn.addEventListener('click', () => {
            const newSection = document.createElement('main');
            newSection.className = 'tasks-section';
            newSection.innerHTML = `
                <div class="tasks-header">
                    <div class="section-title">
                        <label>Section name</label>
                        <input type="text" value="Untitled section">
                    </div>
                    <div class="section-controls">
                       <div class="priority-container">
                           <button class="priority-btn section-btn" data-priority="">
                               <i class="fas fa-flag"></i> Set Priority
                           </button>
                           <div class="priority-popup">
                               <button class="priority-option" data-priority="high">
                                   <span class="priority-dot high"></span> High Priority
                               </button>
                               <button class="priority-option" data-priority="medium">
                                   <span class="priority-dot medium"></span> Medium Priority
                               </button>
                               <button class="priority-option" data-priority="low">
                                   <span class="priority-dot low"></span> Low Priority
                               </button>
                               <button class="priority-option priority-reset" data-priority="">
                                   <i class="fas fa-undo"></i> Reset Priority
                               </button>
                           </div>
                       </div>
                       <div class="deadline-container">
                           <button class="deadline-btn section-btn" data-deadline="">
                               <i class="fas fa-calendar-alt"></i> Set Deadline
                           </button>
                           <div class="deadline-popup">
                               <div class="deadline-tabs">
                                   <button class="deadline-tab active" data-tab="date">
                                       <i class="fas fa-calendar-alt"></i> Pick a Date
                                   </button>
                                   <button class="deadline-tab" data-tab="duration">
                                       <i class="fas fa-clock"></i> Enter Duration
                                   </button>
                               </div>
                               <div class="deadline-content">
                                   <div class="deadline-tab-content active" data-content="date">
                                       <input type="date" class="deadline-picker">
                                   </div>
                                   <div class="deadline-tab-content" data-content="duration">
                                       <div class="duration-input-row">
                                           <input type="number" class="duration-number" min="1" placeholder="5">
                                           <select class="duration-unit">
                                               <option value="days">days</option>
                                               <option value="weeks">weeks</option>
                                               <option value="months">months</option>
                                           </select>
                                       </div>
                                       <button class="duration-apply-btn">Apply Duration</button>
                                   </div>
                               </div>
                               <button class="deadline-reset" data-deadline="">
                                   <i class="fas fa-undo"></i> Reset Deadline
                               </button>
                           </div>
                       </div>
                       <span class="task-count">0</span>
                       <i class="fas fa-chevron-up"></i>
                       <div class="more-options-menu-container">
                           <i class="fas fa-ellipsis-h more-options-trigger"></i>
                           <div class="delete-popup">
                               <button class="delete-section-btn"><i class="fas fa-trash-alt"></i> Delete</button>
                           </div>
                       </div>
                    </div>
                </div>
                <div class="section-info-bar">
                    <p class="drag-info">Hold and drag cards to reorder content</p>
                    <button class="add-subsection-btn"><i class="fas fa-plus"></i> Add Subsection</button>
                </div>
                <div class="subsections-container"></div>
                <div class="task-cards-container">
                    <div class="add-item-card">
                        <div class="add-item-popup">
                            <div class="popup-item popup-course"><i class="fas fa-book-open"></i> <div class="popup-item-text"><strong>Course</strong><span>Courses are perfect to kickoff the Development plan for anyone at any point in their career paths.</span></div></div>
                            <div class="popup-item popup-task"><i class="fas fa-clipboard-list"></i> <div class="popup-item-text"><strong>Task</strong><span>Use this to build anything you want to be a part of the plan.</span></div></div>
                            <div class="popup-item popup-project"><i class="fas fa-ruler-combined"></i> <div class="popup-item-text"><strong>Project</strong><span>Working on projects where the targeted role is required give employees the best hands-on experience.</span></div></div>
                        </div>
                        <p>Explore different learning materials for the skills in your plan</p>
                        <button class="add-item-btn">Add an Item <i class="fas fa-chevron-down"></i></button>
                    </div>
                </div>`;
            sectionsContainer.appendChild(newSection);
            initializeSection(newSection);
            // Immediately refresh counts and empty-state messages for the new section
            updateAllTaskCounts();
        });
    }

    // Initialize section-level sortable
    if (sectionsContainer) {
        sectionSortableInstance = new Sortable(sectionsContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            disabled: !body.classList.contains('edit-mode'),
            handle: '.tasks-header',
            onEnd: function (evt) {
                // Section reordered
            }
        });
    }

    // Initialize existing sections
    document.querySelectorAll('.tasks-section').forEach(section => {
        initializeSection(section);
    });

    // Initialize task counts
    updateAllTaskCounts();

    const keepAddItemCardLast = (container) => {
        const addCard = container.querySelector('.add-item-card');
        if (addCard && addCard !== container.lastElementChild) {
            container.appendChild(addCard);
        }
    };
}); 