import re

with open('frontend/src/pages/LandingPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add activeSection state and observer
content = content.replace(
    'const [isLoading, setIsLoading] = useState(true);',
    'const [isLoading, setIsLoading] = useState(true);\n  const [activeSection, setActiveSection] = useState("home");'
)

# Replace useEffect body
old_use_effect = """  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);
    
    // Simulate data loading
    setIsLoading(false);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);"""

new_use_effect = """  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);
    
    const sections = document.querySelectorAll('section[id], footer[id]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3 }
    );
    sections.forEach((section) => observer.observe(section));
    
    // Simulate data loading
    setIsLoading(false);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);"""
content = content.replace(old_use_effect, new_use_effect)

# 2. Update navLinks
content = content.replace("href: '#'", "href: '#home'")

# 3. Update navLinks rendering
old_nav_links_render = """              {navLinks.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className={`text-sm font-bold tracking-tight transition-colors hover:text-brand-green ${
                      isScrolled ? 'text-brand-navy-500' : 'text-white'
                    }`}
                  >
                    {link.name}
                  </a>
                </li>
              ))}"""

new_nav_links_render = """              {navLinks.map((link) => {
                const sectionId = link.href.replace('#', '');
                const isActive = activeSection === sectionId;
                return (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className={`text-sm font-bold tracking-tight transition-all relative ${
                      isActive 
                        ? 'text-brand-green after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-brand-green after:rounded-full' 
                        : isScrolled ? 'text-brand-navy-500 hover:text-brand-green' : 'text-white hover:text-brand-green'
                    }`}
                  >
                    {link.name}
                  </a>
                </li>
              )})}"""
content = content.replace(old_nav_links_render, new_nav_links_render)

# 4. Update Login button
old_login_btn = """            <Link
              to="/login"
              className="login-btn"
            >"""
new_login_btn = """            <Link
              to="/login"
              className="px-6 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-black rounded-xl shadow-lg shadow-brand-green/20 transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-brand-green/30"
            >"""
content = content.replace(old_login_btn, new_login_btn)

# 5. Add ids to sections
content = content.replace('<section className="relative h-screen', '<section id="home" className="relative h-screen')
content = content.replace('<section className="py-24 md:py-32 bg-brand-navy-500', '<section id="specialties" className="py-24 md:py-32 bg-brand-navy-500')
content = content.replace('<footer className="bg-brand-navy-500 pt-24', '<footer id="contact" className="bg-brand-navy-500 pt-24')

# 6. Update College Cards
old_card = """                <div
                  key={i}
                  className="group relative bg-white p-10 rounded-[2.5rem] border border-brand-border shadow-soft transition-all duration-500 hover:border-brand-green hover:shadow-2xl hover:shadow-brand-navy-500/5 text-right flex flex-col"
                >
                  <div className="text-5xl mb-6 transform transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                    {college.icon}
                  </div>
                  <h3 className="text-xl font-black text-brand-navy-500 mb-4 group-hover:text-brand-green transition-colors">
                    {college.name}
                  </h3>
                  <p className="text-brand-text-secondary text-sm leading-relaxed mb-6 font-medium">
                    {college.desc}
                  </p>
                  <div className="mt-auto pt-6 border-t border-brand-border flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">
                      {college.students}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-brand-primary-50 text-brand-green flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-4 group-hover:translate-x-0">
                      <ArrowLeft size={18} className="rtl:-scale-x-100" />
                    </div>
                  </div>
                </div>"""

new_card = """                <a
                  href={`#colleges-${i}`}
                  key={i}
                  className="group relative bg-white p-10 rounded-[2.5rem] border border-brand-border shadow-soft transition-all duration-500 hover:border-brand-green hover:-translate-y-2 hover:shadow-2xl hover:shadow-brand-navy-500/10 text-right flex flex-col focus:outline-none focus:ring-4 focus:ring-brand-green/30 cursor-pointer block"
                >
                  <div className="text-5xl mb-6 transform transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                    {college.icon}
                  </div>
                  <h3 className="text-xl font-black text-brand-navy-500 mb-4 group-hover:text-brand-green transition-colors">
                    {college.name}
                  </h3>
                  <p className="text-brand-text-secondary text-sm leading-relaxed mb-6 font-medium">
                    {college.desc}
                  </p>
                  <div className="mt-auto pt-6 border-t border-brand-border flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">
                      {college.students}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-brand-green opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        اعرف المزيد
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-brand-primary-50 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-white transition-all duration-500 transform translate-x-4 group-hover:translate-x-0">
                        <ArrowLeft size={18} className="rtl:-scale-x-100" />
                      </div>
                    </div>
                  </div>
                </a>"""
content = content.replace(old_card, new_card)

with open('frontend/src/pages/LandingPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
