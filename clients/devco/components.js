// Shared React Components for Devco
// Using React via CDN - no build step required

// ==================== HEADER COMPONENT ====================
const Header = ({ activePage }) => {
    const navItems = [
        { id: 'catalogue', label: 'Catalogue', href: 'catalogue.html', icon: '📦' },
        { id: 'templates', label: 'Templates', href: 'templates.html', icon: '📄' },
        { id: 'estimates', label: 'Estimates', href: 'estimates.html', icon: '📊' }
    ];

    return (
        <header className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 sticky top-0 z-50 shadow-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo & Nav */}
                    <div className="flex items-center gap-8">
                        <a href="index.html" className="flex items-center gap-3 group">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-xl shadow-lg group-hover:bg-white/30 transition-all duration-300 group-hover:scale-105">
                                📋
                            </div>
                            <span className="text-xl font-bold text-white tracking-tight">Devco</span>
                        </a>
                        <nav className="hidden md:flex items-center gap-1">
                            {navItems.map(item => (
                                <a
                                    key={item.id}
                                    href={item.href}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2
                                        ${activePage === item.id
                                            ? 'bg-white/25 text-white shadow-lg'
                                            : 'text-white/80 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    <span>{item.icon}</span>
                                    {item.label}
                                </a>
                            ))}
                        </nav>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-48 px-4 py-2 pl-10 bg-white/15 border border-white/20 rounded-xl text-white placeholder-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition-all duration-300"
                            />
                            <svg className="absolute left-3 top-2.5 w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round"></path>
                            </svg>
                        </div>
                        <div className="relative group">
                            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-indigo-400 rounded-full flex items-center justify-center text-sm font-bold text-white cursor-pointer shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 ring-2 ring-white/20">
                                DC
                            </div>
                            {/* Dropdown would go here */}
                        </div>
                    </div>
                </div>
            </div>
            {/* Gradient border bottom */}
            <div className="h-1 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400"></div>
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

// ==================== STATUS TABS COMPONENT (Text style like reference) ====================
const StatusTabs = ({ tabs, activeTab, onChange }) => (
    <div className="flex items-center gap-6 border-b border-gray-200 mb-4">
        {tabs.map(tab => (
            <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap
                    ${activeTab === tab.id
                        ? 'text-indigo-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
            >
                {tab.label}
                {tab.count !== undefined && (
                    <span className={`ml-1.5 ${activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'}`}>
                        ({tab.count})
                    </span>
                )}
                {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>
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
        <div className="flex items-center justify-end gap-1 px-4 py-3 border-t border-gray-100">
            <button
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                First
            </button>
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                ‹
            </button>
            {getPageNumbers().map((page, i) => (
                page === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">...</span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`w-7 h-7 text-xs rounded transition-colors ${currentPage === page
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        {page}
                    </button>
                )
            ))}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                ›
            </button>
            <button
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Last
            </button>
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
    Input,
    SearchInput,
    Tabs,
    StatusTabs,
    Pagination,
    IconButton
};
