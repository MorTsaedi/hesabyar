import type { Account } from '../../types/database';

interface TreeViewProps {
  items: Account[];
  selectedId: number | null;
  onSelect: (item: Account) => void;
  level?: number;
  parentId?: number | null;
}

export function AccountTreeView({ items, selectedId, onSelect, level = 0, parentId = null }: TreeViewProps) {
  const filtered = items.filter((a) => a.parentId === parentId);

  if (filtered.length === 0) return null;

  return (
    <ul className={`${level > 0 ? 'mr-6 border-r-2 border-slate-100 pr-3' : ''}`}>
      {filtered.map((item) => (
        <li key={item.id} className="my-0.5">
          <button
            onClick={() => onSelect(item)}
            className={`
              w-full text-right px-2 py-1.5 rounded-md text-sm flex items-center gap-2
              transition-colors hover:bg-slate-100
              ${selectedId === item.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700'}
              ${!item.isActive ? 'opacity-50' : ''}
            `}
          >
            {/* Indent indicator */}
            {level === 0 && (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                item.type === 'asset' ? 'bg-blue-400' :
                item.type === 'liability' ? 'bg-amber-400' :
                item.type === 'equity' ? 'bg-green-400' :
                item.type === 'revenue' ? 'bg-emerald-400' :
                item.type === 'expense' ? 'bg-red-400' :
                'bg-purple-400'
              }`} />
            )}
            <span className="font-mono text-xs text-slate-400 ltr-force ml-1">
              {item.code}
            </span>
            <span>{item.name}</span>
            {!item.isActive && (
              <span className="text-xs text-slate-400 mr-auto">(غیرفعال)</span>
            )}
          </button>
          <AccountTreeView
            items={items}
            selectedId={selectedId}
            onSelect={onSelect}
            level={level + 1}
            parentId={item.id}
          />
        </li>
      ))}
    </ul>
  );
}
