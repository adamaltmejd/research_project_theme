// Custom scrollspy with collapsible nested nav
document.addEventListener('DOMContentLoaded', () => {
    const sideNav = document.getElementById('side-nav')
    if (!sideNav) return

    sideNav.classList.add('js-enabled')

    // Build list of sections from nav links
    const sections = [...sideNav.querySelectorAll('.nav-link')]
        .map(link => ({ el: document.getElementById(link.hash?.slice(1)), link }))
        .filter(s => s.el)

    const update = () => {
        const scrollY = window.scrollY + 120
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

    update()
})
