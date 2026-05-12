const { motion } = window.Motion;

const Navbar = ({ currentView, setCurrentView }) => {
    const navItems = [
        { id: 'home', label: 'Home' },
        { id: 'leagues', label: 'Leagues' },
        { id: 'courts', label: 'Courts' },
        { id: 'innovation', label: 'Innovation' }
    ];

    return (
        <nav className="fixed top-8 left-0 w-full z-50 flex justify-between items-center px-8">
            {/* Left: Logo */}
            <button 
                onClick={() => setCurrentView('home')}
                className="w-12 h-12 rounded-full liquid-glass flex items-center justify-center text-2xl font-heading text-white hover:scale-105 transition-transform"
            >
                b
            </button>

            {/* Center: Navigation Pill */}
            <div className="flex items-center gap-1 p-1 liquid-glass rounded-full">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className={`px-6 py-2 rounded-full transition-all duration-300 relative ${
                            currentView === item.id 
                            ? 'text-white' 
                            : 'text-white/50 hover:text-white/80'
                        }`}
                    >
                        <span className={`relative z-10 font-body text-sm font-medium ${
                            currentView === item.id ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : ''
                        }`}>
                            {item.label}
                        </span>
                        {currentView === item.id && (
                            <motion.div
                                layoutId="nav-glow"
                                className="absolute inset-0 bg-white/5 rounded-full"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>
                ))}
                <button className="ml-4 px-6 py-2 bg-white text-black font-body text-sm font-bold rounded-full hover:bg-white/90 transition-colors">
                    Join the Roster
                </button>
            </div>

            {/* Right: Spacer */}
            <div className="w-12 h-12 invisible" />
        </nav>
    );
};

window.Navbar = Navbar;
