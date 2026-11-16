(() => {
    'use strict';

    const root = new URL('.', document.currentScript.src);
    const indexURL = new URL('index.html', root);
    const mobile = matchMedia('(max-width: 840px)');
    const page = document.querySelector('.page');
    const main = document.querySelector('#main-content');

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function link(title, url, className) {
        const anchor = element('a', className, title);
        anchor.href = url;
        return anchor;
    }

    function button(label, className) {
        const control = element('button', className, label);
        control.type = 'button';
        return control;
    }

    function dialog(title, className) {
        const panel = element('dialog', className);
        const heading = element('h2', 'dialog-title', title);
        heading.id = className + '-title';
        panel.setAttribute('aria-labelledby', heading.id);
        const header = element('div', 'dialog-header');
        const close = button('Close', 'quiet-button');
        close.addEventListener('click', () => panel.close());
        header.append(heading, close);
        panel.append(header);
        document.body.append(panel);
        panel.addEventListener('click', (event) => {
            if (event.target !== panel) return;
            const rect = panel.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right ||
                event.clientY < rect.top || event.clientY > rect.bottom) panel.close();
        });
        return panel;
    }

    const header = element('header', 'site-header');
    const bar = element('div', 'site-bar');
    const toggle = button('☰', 'quiet-button menu-button');
    toggle.hidden = true;
    bar.append(toggle, link('JIC.IT', indexURL, 'wordmark'));
    const searchButton = button('Search courses and lessons', 'search-button');
    searchButton.hidden = true;
    const shortcut = element('kbd', 'key-hint', '/');
    shortcut.setAttribute('aria-hidden', 'true');
    searchButton.append(shortcut);
    bar.append(searchButton);
    header.append(bar);
    document.body.insertBefore(header, page);

    const frame = element('div', 'site-frame');
    page.before(frame);
    frame.append(page);

    const normalize = (value) => (value || '').normalize('NFKC').toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}+#]+/gu, ' ').trim();

    function courseNavigation(entries, active) {
        const nav = element('nav', 'course-navigation');
        nav.setAttribute('aria-label', 'Courses and lessons');
        nav.append(element('p', 'nav-caption', 'Courses'));

        function rows(items) {
            const list = element('ul', 'course-list');
            for (const item of items) {
                const row = element('li');
                const group = element('div', 'nav-row');
                const anchor = link(item.title, new URL(item.url, root), 'nav-link');
                const isCurrent = item === active?.item;
                const isAncestor = active?.parents.includes(item);
                if (isCurrent) anchor.setAttribute('aria-current', 'page');
                if (isAncestor) row.classList.add('active-course');
                group.append(anchor);
                row.append(group);

                if (item.children?.length) {
                    const children = rows(item.children);
                    children.id = 'nav-' + item.url.replace(/[^a-z0-9]+/gi, '-');
                    children.hidden = !(isCurrent || isAncestor);
                    const expand = button('›', 'quiet-button expand-button');
                    expand.setAttribute('aria-label', 'Toggle lessons for ' + item.title);
                    expand.setAttribute('aria-controls', children.id);
                    expand.setAttribute('aria-expanded', String(!children.hidden));
                    expand.addEventListener('click', () => {
                        children.hidden = !children.hidden;
                        expand.setAttribute('aria-expanded', String(!children.hidden));
                    });
                    group.append(expand);
                    row.append(children);
                }
                list.append(row);
            }
            return list;
        }

        nav.append(rows(entries));
        return nav;
    }

    function setupSidebar(entries, active) {
        const nav = courseNavigation(entries, active);
        const sidebar = element('aside', 'site-sidebar');
        sidebar.id = 'course-sidebar';
        frame.prepend(sidebar);

        const drawer = dialog('Course navigation', 'navigation-drawer');
        drawer.id = 'course-drawer';
        let collapsed = false;
        try {
            collapsed = sessionStorage.getItem('jicit-sidebar') === 'collapsed';
        } catch {
            // Storage may be unavailable in private or restricted contexts.
        }

        function sync() {
            if (mobile.matches) {
                if (nav.parentElement !== drawer) drawer.append(nav);
                sidebar.hidden = true;
                toggle.setAttribute('aria-controls', drawer.id);
                toggle.setAttribute('aria-expanded', String(drawer.open));
                toggle.setAttribute('aria-label', 'Open course navigation');
            } else {
                if (drawer.open) drawer.close();
                if (nav.parentElement !== sidebar) sidebar.append(nav);
                sidebar.hidden = collapsed;
                toggle.setAttribute('aria-controls', sidebar.id);
                toggle.setAttribute('aria-expanded', String(!collapsed));
                toggle.setAttribute('aria-label', collapsed ? 'Show course navigation' : 'Hide course navigation');
            }
        }

        toggle.addEventListener('click', () => {
            if (mobile.matches) {
                drawer.showModal();
            } else {
                collapsed = !collapsed;
                try {
                    sessionStorage.setItem('jicit-sidebar', collapsed ? 'collapsed' : 'open');
                } catch {
                    // The control also works without storing the preference.
                }
            }
            sync();
        });
        drawer.addEventListener('close', sync);
        mobile.addEventListener('change', sync);
        sync();
        toggle.hidden = false;
        if (!mobile.matches && !collapsed) {
            const current = nav.querySelector('[aria-current="page"]');
            if (current) {
                const excess = current.getBoundingClientRect().bottom - sidebar.getBoundingClientRect().bottom;
                if (excess > 0) sidebar.scrollTop += excess + 16;
            }
        }
    }

    function setupSearch(records) {
        const panel = dialog('Search', 'search-dialog');
        const label = element('label', 'visually-hidden', 'Search courses and lessons');
        label.htmlFor = 'site-search';
        const input = element('input', 'search-input');
        input.id = label.htmlFor;
        input.type = 'search';
        input.placeholder = 'Try VLAN, DHCP, or Python';
        input.autocomplete = 'off';
        input.autofocus = true;
        const status = element('p', 'search-status');
        status.setAttribute('role', 'status');
        const results = element('ul', 'search-results');
        panel.append(label, input, status, results);

        const indexed = records.map(({ item, parents }) => ({
            item,
            parent: parents.map(({ title }) => title).join(' / '),
            title: normalize(item.title),
            terms: normalize([item.title, ...parents.map(({ title }) => title), item.description, item.keywords].join(' '))
        }));

        function render() {
            const query = normalize(input.value);
            results.replaceChildren();
            if (!query) {
                status.textContent = input.value.trim() ? 'No matching courses or lessons.' : 'Enter a course, lesson, or topic.';
                return;
            }
            const words = query.split(' ');
            const matches = indexed.filter(({ terms }) => words.every((word) => terms.includes(word)));
            const score = ({ title }) => title === query ? 3 : title.startsWith(query) ? 2 : title.includes(query) ? 1 : 0;
            matches.sort((first, second) => score(second) - score(first));
            status.textContent = matches.length ? matches.length + (matches.length === 1 ? ' result' : ' results') : 'No matching courses or lessons.';
            for (const { item, parent } of matches) {
                const row = element('li');
                const anchor = link(item.title, new URL(item.url, root), 'search-result');
                anchor.append(element('small', '', parent || 'Course'));
                row.append(anchor);
                results.append(row);
            }
        }

        function open() {
            if (!panel.open) panel.showModal();
            input.focus();
            input.select();
        }

        panel.addEventListener('keydown', (event) => {
            const links = [...results.querySelectorAll('a')];
            const index = links.indexOf(document.activeElement);
            if (event.key === 'Enter' && document.activeElement === input && links.length) links[0].click();
            if (!['ArrowDown', 'ArrowUp'].includes(event.key) || !links.length || (index < 0 && document.activeElement !== input)) return;
            event.preventDefault();
            if (event.key === 'ArrowDown') links[Math.min(index + 1, links.length - 1)].focus();
            else (links[index - 1] || input).focus();
        });
        input.addEventListener('input', render);
        searchButton.addEventListener('click', open);
        const opener = document.querySelector('[data-open-search]');
        if (opener) {
            opener.hidden = false;
            opener.addEventListener('click', open);
        }
        document.addEventListener('keydown', (event) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
                event.key !== '/' || document.querySelector('dialog[open]') ||
                event.target.closest('input, textarea, select, [contenteditable]')) return;
            event.preventDefault();
            searchButton.focus();
            open();
        });
        render();
        searchButton.hidden = false;
    }

    function breadcrumbs(active) {
        const slot = document.querySelector('#breadcrumbs');
        if (!slot || !active) return;
        const nav = element('nav', 'breadcrumbs');
        nav.setAttribute('aria-label', 'Breadcrumb');
        const list = element('ol');
        for (const item of [{ title: 'Courses', url: 'index.html' }, ...active.parents, active.item]) {
            const row = element('li');
            if (item === active.item) {
                row.textContent = item.title;
                row.setAttribute('aria-current', 'page');
            } else {
                row.append(link(item.title, new URL(item.url, root)));
            }
            list.append(row);
        }
        nav.append(list);
        slot.replaceChildren(nav);
    }

    function lessonSequence(active) {
        const lessons = active?.parents.at(-1)?.children;
        if (!lessons) return;
        const index = lessons.indexOf(active.item);
        const nav = element('nav', 'lesson-sequence');
        nav.setAttribute('aria-label', 'Lesson navigation');

        for (const [item, label, direction] of [
            [lessons[index - 1], '← Previous lesson', 'previous'],
            [lessons[index + 1], 'Next lesson →', 'next']
        ]) {
            if (!item) continue;
            const anchor = link('', new URL(item.url, root), direction);
            anchor.rel = direction === 'previous' ? 'prev' : 'next';
            anchor.append(element('span', '', label), element('strong', '', item.title));
            nav.append(anchor);
        }
        main.append(nav);
    }

    function lessonContents() {
        const headings = [...main.querySelectorAll('h2, h3, h4, h5, h6')].filter((heading) => !heading.matches('.note'));
        if (!headings.length) return;
        const toc = element('details', 'lesson-toc');
        toc.open = true;
        toc.append(element('summary', '', 'On this page'));
        const nav = element('nav');
        nav.setAttribute('aria-label', 'On this page');
        const list = element('ul');
        const used = new Set([...document.querySelectorAll('[id]')].map((node) => node.id));
        for (const heading of headings) {
            if (!heading.id) {
                const slug = normalize(heading.textContent).replace(/[+#]/g, '').trim().replace(/ +/g, '-') || 'section';
                let id = slug;
                for (let suffix = 2; used.has(id); suffix++) id = slug + '-' + suffix;
                heading.id = id;
                used.add(id);
            }
            const row = element('li', 'toc-' + heading.tagName.toLowerCase());
            const anchor = link(heading.textContent.trim(), '#' + encodeURIComponent(heading.id));
            anchor.addEventListener('click', () => {
                if (matchMedia('(max-width: 1130px)').matches) toc.open = false;
            });
            row.append(anchor);
            list.append(row);
        }
        nav.append(list);
        toc.append(nav);
        main.before(toc);
        if (matchMedia('(max-width: 1130px)').matches) toc.open = false;
        const hash = location.hash;
        if (hash) {
            try {
                document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
            } catch {
                // An invalid fragment can be ignored.
            }
        }
    }

    // Highlight the small set of languages used by the unmarked lesson snippets.
    function highlight(block) {
        const code = block.firstElementChild;
        if (!code?.matches('code') || block.children.length !== 1) return;
        let tokens;
        if (location.pathname.includes('/Programming/Python/')) {
            tokens = /(?<comment>#[^\n]*)|(?<string>"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(?<keyword>\b(?:and|as|break|continue|def|elif|else|except|False|for|if|in|None|not|or|pass|raise|return|True|try|while|with)\b)/g;
        } else if (location.pathname.includes('/Intro_to_web_design/')) {
            tokens = /(?<comment><!--[\s\S]*?-->|\/\*[\s\S]*?\*\/)|(?<string>"[^"\n]*"|'[^'\n]*')|(?<keyword><\/?[!a-z][\w-]*|\b[a-z-]+(?=\s*:))/gi;
        } else {
            return;
        }

        for (const node of [...code.childNodes]) {
            if (node.nodeType !== Node.TEXT_NODE) continue;
            const source = node.textContent;
            const pieces = document.createDocumentFragment();
            let offset = 0;
            for (const token of source.matchAll(tokens)) {
                const kind = Object.keys(token.groups).find((name) => token.groups[name] !== undefined);
                pieces.append(source.slice(offset, token.index), element('span', kind, token[0]));
                offset = token.index + token[0].length;
            }
            if (offset) {
                pieces.append(source.slice(offset));
                node.replaceWith(pieces);
            }
        }
    }

    function enhanceCode() {
        for (const block of main.querySelectorAll('pre')) {
            if (block.classList.contains('output')) continue;
            const commands = [...block.querySelectorAll('.user-input')].map((command) => command.textContent.trim());
            const snippet = block;
            if (!commands.length && !block.querySelector('code')?.textContent.trim()) continue;
            highlight(block);
            const title = commands.length ? 'Copy commands' : 'Copy code';
            const text = commands.length ? commands.join('\n') : snippet.textContent;
            const copy = button(title, 'quiet-button copy-button');
            copy.setAttribute('aria-live', 'polite');
            let reset;
            copy.addEventListener('click', async () => {
                clearTimeout(reset);
                try {
                    await navigator.clipboard.writeText(text);
                    copy.textContent = 'Copied';
                } catch {
                    const range = document.createRange();
                    range.selectNodeContents(snippet);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    copy.textContent = 'Selected. Copy manually';
                }
                reset = setTimeout(() => { copy.textContent = title; }, 2200);
            });
            const wrapper = element('div', 'code-frame');
            const toolbar = element('div', 'code-toolbar');
            toolbar.append(copy);
            block.before(wrapper);
            wrapper.append(toolbar, block);
        }
    }

    const isLesson = document.body.classList.contains('lesson');
    if (isLesson) {
        lessonContents();
        enhanceCode();
        for (const video of main.querySelectorAll('iframe')) video.loading = 'lazy';
    }

    fetch(new URL('navigation.json', root))
        .then((response) => {
            if (!response.ok) throw new Error('Could not load course navigation');
            return response.json();
        })
        .then((entries) => {
            const records = [];
            function collect(items, parents = []) {
                for (const item of items) {
                    records.push({ item, parents });
                    if (item.children) collect(item.children, [...parents, item]);
                }
            }
            collect(entries);
            const currentPath = location.pathname.replace(/\/$/, '/index.html');
            const active = records.find(({ item }) => new URL(item.url, root).pathname === currentPath);
            setupSidebar(entries, active);
            setupSearch(records);
            breadcrumbs(active);
            if (isLesson) lessonSequence(active);
        })
        .catch((error) => console.warn(error.message));
})();
