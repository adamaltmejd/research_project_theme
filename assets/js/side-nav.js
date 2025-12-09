// Custom scrollspy with collapsible nested nav
document.addEventListener('DOMContentLoaded', () => {
    const sideNav = document.getElementById('side-nav')
    if (!sideNav) return

    sideNav.classList.add('js-enabled')

    const sideNavContainer = sideNav.closest('.side-nav-container')
    const desktopQuery = window.matchMedia('(min-width: 992px)') // matches Bootstrap lg breakpoint

    const setScrollOffset = () => {
        // Mobile: offset by the sticky top nav height; Desktop: no offset needed
        const mobileGap = 12
        const offset = desktopQuery.matches
            ? 0
            : (sideNavContainer?.offsetHeight || 0) + mobileGap

        scrollOffset = offset
        document.documentElement.style.setProperty('--side-nav-offset', `${offset}px`)
    }

    let scrollOffset = 0
    setScrollOffset()

    // Build list of sections from nav links
    const sections = [...sideNav.querySelectorAll('.nav-link')]
        .map(link => ({ el: document.getElementById(link.hash?.slice(1)), link }))
        .filter(s => s.el)

    const update = () => {
        const scrollY = window.scrollY + scrollOffset
        const current = sections.findLast(s => s.el.offsetTop <= scrollY)

        // Clear all states
        sideNav.querySelectorAll('.active, .expanded').forEach(el => {
            el.classList.remove('active', 'expanded')
        })

        if (!current) return

        current.link.classList.add('active')

        // Handle nested nav: expand it and activate parent h1
        const nested = current.link.closest('.nav-nested')
        if (nested) {
            nested.classList.add('expanded')
            nested.previousElementSibling?.classList.add('active')
        } else {
            // H1 link - expand following nested nav if exists
            current.link.nextElementSibling?.classList.add('expanded')
        }
    }

    let ticking = false
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => { update(); ticking = false })
            ticking = true
        }
    })

    const recalcOffset = () => {
        setScrollOffset()
        update()
    }

    window.addEventListener('resize', recalcOffset)
    desktopQuery.addEventListener('change', recalcOffset)

    const scrollToSection = (id, behavior = 'smooth') => {
        const target = document.getElementById(id)
        if (!target) return

        const top = target.getBoundingClientRect().top + window.scrollY - scrollOffset
        window.scrollTo({ top, behavior })
    }

    // On small screens, Safari can ignore scroll-margin for in-page anchors.
    // Manually adjust scroll position when clicking the side nav.
    sideNav.addEventListener('click', event => {
        if (desktopQuery.matches) return

        const link = event.target.closest('.nav-link')
        if (!link || !sideNav.contains(link)) return

        const targetId = link.hash?.slice(1)
        if (!targetId) return

        event.preventDefault()
        scrollToSection(targetId)
        history.replaceState(null, '', `#${targetId}`)
    })

    if (window.location.hash && !desktopQuery.matches) {
        scrollToSection(window.location.hash.slice(1), 'auto')
    }

    update()
})
