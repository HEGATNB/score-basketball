const { useState } = React;
const { AnimatePresence, motion } = window.Motion;

const App = () => {
    const [currentView, setCurrentView] = useState('home');

    const renderView = () => {
        switch (currentView) {
            case 'home':
                return <HomeView key="home" />;
            default:
                return (
                    <motion.div 
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-screen flex items-center justify-center text-4xl font-heading italic"
                    >
                        {currentView.charAt(0).toUpperCase() + currentView.slice(1)} Coming Soon
                    </motion.div>
                );
        }
    };

    return (
        <div className="relative min-h-screen bg-black text-white">
            <Navbar currentView={currentView} setCurrentView={setCurrentView} />
            
            <main>
                <AnimatePresence mode="wait">
                    {renderView()}
                </AnimatePresence>
            </main>
        </div>
    );
};

window.App = App;
