// Custom scrollspy with collapsible nested nav
document.addEventListener('DOMContentLoaded', () => {
    const sideNav = document.getElementById('side-nav')
    if (!sideNav) return

    sideNav.classList.add('js-enabled')

    const sideNavContainer = sideNav.closest('.side-nav-container')
    const lgWindow = window.matchMedia('(min-width: 992px)') // matches Bootstrap lg breakpoint
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const navLinks = [...sideNav.querySelectorAll('.nav-link')]

    let scrollOffset = 0
    const setScrollOffset = () => {
        const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.75 || 12
        const navHeight = sideNavContainer?.offsetHeight || sideNav.offsetHeight || 0
        const offset = lgWindow.matches ? gap : gap + navHeight
        scrollOffset = offset
        document.documentElement.style.setProperty('--side-nav-offset', `${offset}px`)
    }

    let sectionPositions = []
    const refreshSections = () => {
        sectionPositions = navLinks
            .map(link => {
                const id = link.hash?.slice(1)
                if (!id) return null
                const el = document.getElementById(id)
                if (!el) return null
                return { link, top: el.offsetTop }
            })
            .filter(Boolean)
    }

    setScrollOffset()
    refreshSections()

    const update = () => {
        if (!sectionPositions.length) return

        const scrollY = window.scrollY + scrollOffset + 1
        let current = sectionPositions[0]

        for (const section of sectionPositions) {
            if (section.top <= scrollY) {
                current = section
            } else {
                break
            }
        }

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
        refreshSections()
        update()
    }

    window.addEventListener('resize', recalcOffset)
    lgWindow.addEventListener('change', recalcOffset)
    window.addEventListener('load', recalcOffset)

    if (sideNavContainer && 'ResizeObserver' in window) {
        const resizeObserver = new ResizeObserver(() => recalcOffset())
        resizeObserver.observe(sideNavContainer)
    }

    const scrollToSection = (id, behavior = 'smooth') => {
        const target = document.getElementById(id)
        if (!target) return

        const top = target.offsetTop - scrollOffset
        window.scrollTo({ top, behavior })
    }

    // Handle nav link clicks to apply the computed offset consistently across browsers.
    navLinks.forEach(link => {
        const id = link.hash?.slice(1)
        if (!id) return

        link.addEventListener('click', event => {
            event.preventDefault()
            recalcOffset()
            const behavior = prefersReducedMotion.matches ? 'auto' : 'smooth'
            scrollToSection(id, behavior)
            if (history.replaceState) {
                history.replaceState(null, '', `#${id}`)
            }
        })
    })

    // If we land on the page with a hash, align it using the computed offset.
    if (location.hash?.length > 1) {
        const id = location.hash.slice(1)
        requestAnimationFrame(() => scrollToSection(id, 'auto'))
    }

    update()
})
