
const handleDeleteItem = async (section, item) => {
    if (!confirm('Are you sure you want to delete this line item?')) return;

    const typeMap = {
        'Labor': 'estimateLineItemsLabor',
        'Equipment': 'estimateLineItemsEquipment',
        'Material': 'estimateLineItemsMaterial',
        'Tools': 'estimateLineItemsTool',
        'Overhead': 'estimateLineItemsOverhead',
        'Subcontractor': 'estimateLineItemsSubcontractor',
        'Disposal': 'estimateLineItemsDisposal',
        'Miscellaneous': 'estimateLineItemsMiscellaneous'
    };
    const type = typeMap[section.id];

    // Optimistic Update
    setEstimate(prev => ({
        ...prev,
        [section.key]: (prev[section.key] || []).filter(i => i._id !== item._id)
    }));

    try {
        await fetch('/webhook/devcoBackend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'deleteCatalogueItem',
                payload: { type: type, id: item._id }
            })
        });
        // Refresh in background to ensure sync
        loadEstimate();
    } catch (e) {
        console.error('Error deleting item', e);
        alert("Failed to delete item.");
        loadEstimate(); // Revert
    }
};
