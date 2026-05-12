import type { ReactNode } from 'react';
import { FixedSizeList as List } from 'react-window';

interface VirtualTableProps {
  data: any[];
  columns: { key: string; label: string; width: number; render?: (item: any) => ReactNode }[];
  height?: number;
  itemSize?: number;
}

const Row = ({ index, style, data }: any) => {
  const item = data.items[index];
  const columns = data.columns;

  return (
    <div style={style} className="flex border-b border-slate-800/50 hover:bg-slate-800/30">
      {columns.map((col: any) => (
        <div
          key={col.key}
          style={{ width: col.width }}
          className="px-4 py-3 truncate"
        >
          {col.render ? col.render(item) : item[col.key]}
        </div>
      ))}
    </div>
  );
};

export function VirtualTable({
  data,
  columns,
  height = 400,
  itemSize = 50
}: VirtualTableProps) {
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex bg-slate-800/50 font-bold text-sm">
        {columns.map((col) => (
          <div
            key={col.key}
            style={{ width: col.width }}
            className="px-4 py-3 text-slate-400"
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Virtualized rows */}
      <List
        height={height}
        itemCount={data.length}
        itemSize={itemSize}
        width="100%"
        itemData={{ items: data, columns }}
      >
        {Row}
      </List>
    </div>
  );
}
