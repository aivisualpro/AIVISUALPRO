// Shared React Components for Devco
// Using React via CDN - no build step required

// ==================== HEADER COMPONENT ====================
const Header = ({ activePage, rightContent }) => {
    const navItems = [
        { id: 'catalogue', label: 'Catalogue', href: 'catalogue.html', icon: 'package' },
        { id: 'templates', label: 'Templates', href: 'templates.html', icon: 'file-text' },
        { id: 'estimates', label: 'Estimates', href: 'estimates.html', icon: 'calculator' },
        { id: 'constants', label: 'Constants', href: 'constants.html', icon: 'sliders' }
    ];

    // Lucide-style icon SVGs
    const icons = {
        'package': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>,
        'file-text': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>,
        'calculator': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></svg>,
        'sliders': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7" /><path d="M4 10V3" /><path d="M12 21v-9" /><path d="M12 8V3" /><path d="M20 21v-5" /><path d="M20 12V3" /><path d="M1 14h6" /><path d="M9 8h6" /><path d="M17 16h6" /></svg>
    };

    return (
        <header
            className="sticky top-0 z-50"
            style={{
                background: '#f0f2f5',
            }}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo & Nav */}
                    <div className="flex items-center gap-6">
                        <a href="index.html" className="flex items-center group">
                            <span
                                className="text-xl font-bold tracking-tight px-4 py-2 rounded-xl transition-all duration-300"
                                style={{
                                    background: '#f0f2f5',
                                    boxShadow: '3px 3px 6px #d1d5db, -3px -3px 6px #ffffff',
                                    color: '#1f2937'
                                }}
                            >
                                DEVCO Estimates
                            </span>
                        </a>
                        <nav className="hidden md:flex items-center gap-2">
                            {navItems.map(item => (
                                <a
                                    key={item.id}
                                    href={item.href}
                                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2"
                                    style={activePage === item.id ? {
                                        background: '#1f2937',
                                        boxShadow: '2px 2px 4px #d1d5db, -2px -2px 4px #ffffff',
                                        color: '#ffffff'
                                    } : {
                                        background: '#f0f2f5',
                                        boxShadow: '2px 2px 4px #d1d5db, -2px -2px 4px #ffffff',
                                        color: '#6b7280'
                                    }}
                                >
                                    {icons[item.icon]}
                                    {item.label}
                                </a>
                            ))}
                        </nav>
                    </div>

                    {/* Right Actions - Render custom content if provided */}
                    {rightContent && (
                        <div className="flex items-center gap-4">
                            {rightContent}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

// ==================== BUTTON COMPONENTS ====================
const Button = ({ children, onClick, variant = 'primary', size = 'md', className = '', ...props }) => {
    const variants = {
        primary: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25',
        secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm',
        danger: 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/25',
        ghost: 'text-gray-600 hover:bg-gray-100'
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base'
    };

    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-2 font-semibold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

// ==================== CARD COMPONENT ====================
const Card = ({ children, className = '', hover = true }) => {
    return (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${hover ? 'hover:shadow-lg hover:border-gray-200 transition-all duration-300' : ''} ${className}`}>
            {children}
        </div>
    );
};

// ==================== STAT CARD COMPONENT ====================
const StatCard = ({ icon, value, label, color = 'blue', trend }) => {
    const colors = {
        blue: 'from-blue-100 to-indigo-100 text-blue-600',
        green: 'from-emerald-100 to-teal-100 text-emerald-600',
        purple: 'from-purple-100 to-violet-100 text-purple-600',
        orange: 'from-orange-100 to-amber-100 text-orange-600',
        pink: 'from-pink-100 to-rose-100 text-pink-600'
    };

    return (
        <Card className="p-6">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-2xl mb-4`}>
                {icon}
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <div className="text-3xl font-bold text-gray-900 tracking-tight">{value}</div>
                    <div className="text-sm text-gray-500 mt-1">{label}</div>
                </div>
                {trend && (
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </div>
                )}
            </div>
        </Card>
    );
};

// ==================== TABLE COMPONENTS ====================
const Table = ({ children, className = '' }) => (
    <div className="overflow-x-auto">
        <table className={`w-full text-xs ${className}`}>{children}</table>
    </div>
);

const TableHead = ({ children }) => (
    <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>
);

const TableBody = ({ children }) => (
    <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>
);

const TableRow = ({ children, className = '', onClick }) => (
    <tr
        className={`hover:bg-gray-50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
    >
        {children}
    </tr>
);

const TableHeader = ({ children, className = '' }) => (
    <th className={`px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider ${className}`}>
        {children}
    </th>
);

const TableCell = ({ children, className = '' }) => (
    <td className={`px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap ${className}`}>{children}</td>
);

// ==================== BADGE COMPONENT ====================
const Badge = ({ children, variant = 'default' }) => {
    const variants = {
        default: 'bg-gray-100 text-gray-600 border border-gray-200',
        success: 'bg-green-50 text-green-700 border border-green-200',
        warning: 'bg-amber-50 text-amber-700 border border-amber-200',
        danger: 'bg-red-50 text-red-700 border border-red-200',
        info: 'bg-blue-50 text-blue-700 border border-blue-200',
        purple: 'bg-purple-50 text-purple-700 border border-purple-200',
        cyan: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
        orange: 'bg-orange-50 text-orange-700 border border-orange-200',
        pink: 'bg-pink-50 text-pink-700 border border-pink-200'
    };

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${variants[variant]}`}>
            {children}
        </span>
    );
};

// ==================== ACTION DROPDOWN COMPONENT ====================
const ActionDropdown = ({ actions = [] }) => {
    const [open, setOpen] = React.useState(false);
    const dropdownRef = React.useRef(null);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
                className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
            >
                Action
                <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="m6 9 6 6 6-6"></path>
                </svg>
            </button>
            {open && (
                <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                    {actions.map((action, i) => (
                        <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); action.onClick(); setOpen(false); }}
                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                            {action.icon && <span className="text-gray-400">{action.icon}</span>}
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ==================== LOADING COMPONENT ====================
const Loading = ({ text = 'Loading...' }) => (
    <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 text-sm">{text}</p>
    </div>
);

// ==================== EMPTY STATE COMPONENT ====================
const EmptyState = ({ icon = '📦', title, message, action }) => (
    <div className="text-center py-16">
        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
            {icon}
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">{message}</p>
        {action}
    </div>
);

// ==================== MODAL COMPONENT ====================
const Modal = ({ isOpen, onClose, title, children, footer }) => {
    React.useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden animate-modal">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {children}
                </div>
                {footer && (
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

// ==================== INPUT COMPONENT ====================
const Input = ({ label, type = 'text', value, onChange, placeholder, className = '', ...props }) => (
    <div className={className}>
        {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-gray-50/50 hover:bg-white"
            {...props}
        />
    </div>
);

// ==================== SEARCH INPUT COMPONENT ====================
const SearchInput = ({ value, onChange, placeholder = 'Search...', className = '' }) => (
    <div className={`relative ${className}`}>
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full px-4 py-2.5 pl-10 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 hover:bg-white"
        />
        <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round"></path>
        </svg>
    </div>
);

// ==================== TABS COMPONENT ====================
const Tabs = ({ tabs, activeTab, onChange }) => (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(tab => (
            <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300
                    ${activeTab === tab.id
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                        : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
            >
                {tab.icon && <span>{tab.icon}</span>}
                {tab.label}
            </button>
        ))}
    </div>
);

// ==================== STATUS TABS COMPONENT (Neumorphic Design) ====================
const StatusTabs = ({ tabs, activeTab, onChange }) => (
    <div className="flex items-center gap-2 py-3">
        {tabs.map(tab => (
            <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className="h-9 px-4 text-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center rounded-xl"
                style={activeTab === tab.id ? {
                    background: '#1f2937',
                    boxShadow: '2px 2px 4px #d1d5db, -2px -2px 4px #ffffff',
                    color: '#ffffff'
                } : {
                    background: '#f0f2f5',
                    boxShadow: '2px 2px 4px #d1d5db, -2px -2px 4px #ffffff',
                    color: '#6b7280'
                }}
            >
                {tab.label}
                {tab.count !== undefined && (
                    <span className="ml-1.5" style={{ color: activeTab === tab.id ? '#9ca3af' : '#9ca3af' }}>
                        ({tab.count})
                    </span>
                )}
            </button>
        ))}
    </div>
);

// ==================== PAGINATION COMPONENT ====================
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    const getPageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                pages.push(i);
            }
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between px-6 py-4" style={{ background: '#f9fafb' }}>
            {/* Info */}
            <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
            </span>

            {/* Navigation */}
            <div className="flex items-center gap-1">
                {/* Previous */}
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    style={{ background: currentPage === 1 ? '#f3f4f6' : '#ffffff' }}
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6"></path>
                    </svg>
                </button>

                {/* Page Numbers */}
                {getPageNumbers().map((page, i) => (
                    page === '...' ? (
                        <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-sm text-gray-400">...</span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange(page)}
                            className={`w-8 h-8 text-sm rounded-lg border transition-all ${currentPage === page
                                ? 'bg-gray-900 text-white border-gray-900 font-medium'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {page}
                        </button>
                    )
                ))}

                {/* Next */}
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    style={{ background: currentPage === totalPages ? '#f3f4f6' : '#ffffff' }}
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </button>
            </div>
        </div>
    );
};

// ==================== ACTION BUTTON ICON ====================
const IconButton = ({ icon, onClick, variant = 'default', title = '' }) => {
    const variants = {
        default: 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50',
        danger: 'text-gray-500 hover:text-red-600 hover:bg-red-50',
        success: 'text-gray-500 hover:text-green-600 hover:bg-green-50'
    };

    return (
        <button
            onClick={onClick}
            title={title}
            className={`p-2 rounded-lg transition-all duration-300 ${variants[variant]}`}
        >
            {icon}
        </button>
    );
};

// ==================== SEARCHABLE SELECT COMPONENT ====================
const SearchableSelect = ({ label, value, onChange, options = [], placeholder = 'Select...' }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const dropdownRef = React.useRef(null);

    const filteredOptions = options.filter(opt =>
        String(opt).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isNewValue = searchTerm && !options.some(opt =>
        String(opt).toLowerCase() === searchTerm.toLowerCase()
    );

    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (opt) => {
        onChange(opt);
        setSearchTerm('');
        setIsOpen(false);
    };

    const handleAddNew = () => {
        if (searchTerm.trim()) {
            onChange(searchTerm.trim());
            setSearchTerm('');
            setIsOpen(false);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
            <div
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm cursor-pointer flex items-center justify-between transition-all duration-300 bg-gray-50/50 hover:bg-white"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={value ? 'text-gray-900' : 'text-gray-400'}>
                    {value || placeholder}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="m6 9 6 6 6-6"></path>
                </svg>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-gray-50">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Type to search..."
                            className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {filteredOptions.map((opt, i) => (
                            <div
                                key={i}
                                onClick={() => handleSelect(opt)}
                                className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 ${value === opt ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-600'}`}
                            >
                                {opt}
                            </div>
                        ))}
                        {filteredOptions.length === 0 && !isNewValue && (
                            <div className="px-4 py-3 text-sm text-gray-400 text-center">No options found</div>
                        )}
                        {isNewValue && (
                            <div
                                onClick={handleAddNew}
                                className="px-4 py-2 text-sm cursor-pointer text-indigo-600 hover:bg-indigo-50 font-medium border-t border-gray-50 flex items-center gap-2"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path d="M12 5v14M5 12h14"></path>
                                </svg>
                                Add "{searchTerm}"
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== TOAST COMPONENT ====================
const Toast = ({ message, type = 'info', onClose }) => {
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const variants = {
        success: 'bg-white border-l-4 border-green-500 text-gray-800',
        error: 'bg-white border-l-4 border-red-500 text-gray-800',
        info: 'bg-white border-l-4 border-blue-500 text-gray-800',
        warning: 'bg-white border-l-4 border-amber-500 text-gray-800'
    };

    const icons = {
        success: <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
        error: <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
        info: <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        warning: <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
    };

    return (
        <div className={`flex items-center w-full max-w-sm p-4 mb-4 rounded-lg shadow-lg shadow-gray-200 transition-all duration-300 animate-in slide-in-from-right-full ${variants[type]}`}>
            <div className="flex-shrink-0">
                {icons[type]}
            </div>
            <div className="ml-3 text-sm font-medium pr-4">
                {message}
            </div>
            <button onClick={onClose} className="ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 text-gray-500 items-center justify-center transition-colors">
                <span className="sr-only">Close</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    );
};

// ==================== TOAST CONTAINER COMPONENT ====================
const ToastContainer = ({ toasts, removeToast }) => {
    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col items-end gap-2">
            {toasts.map(toast => (
                <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
};

// ==================== CONFIRM MODAL COMPONENT ====================
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger' }) => {
    if (!isOpen) return null;
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <Button onClick={onClose} variant="secondary">{cancelText}</Button>
                    <Button onClick={onConfirm} variant={variant}>{confirmText}</Button>
                </>
            }
        >
            <div className="text-sm text-gray-600">
                {message}
            </div>
        </Modal>
    );
};

// Make components available globally
window.DevcoComponents = {
    Header,
    Button,
    Card,
    StatCard,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableHeader,
    TableCell,
    Badge,
    ActionDropdown,
    Loading,
    EmptyState,
    Modal,
    ConfirmModal,
    Input,
    SearchInput,
    SearchableSelect,
    Tabs,
    StatusTabs,
    Pagination,
    IconButton,
    Toast,
    ToastContainer
};
