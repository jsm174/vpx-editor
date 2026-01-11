import type { Collection } from '../../collection-manager/shared/component.js';

export interface SelectElementItem {
  name: string;
  type: string;
  layer: string;
  image: string;
  material: string;
  physicsMaterial: string;
  collection: string;
  collidable: string;
  visible: string;
  timerEnabled: string;
  depthBias: string;
  staticRendering: string;
  reflections: string;
  surface: string;
  isCollection: boolean;
}

export interface SelectElementCallbacks {
  onSelect: (itemNames: string[]) => void;
  onClose: () => void;
}

const COLUMNS = [
  { key: 'name', label: 'Name', width: 200 },
  { key: 'type', label: 'Type', width: 70 },
  { key: 'layer', label: 'Layer', width: 100 },
  { key: 'image', label: 'Image', width: 200 },
  { key: 'material', label: 'Material', width: 200 },
  { key: 'physicsMaterial', label: 'Physics Material', width: 200 },
  { key: 'collection', label: 'Collection', width: 100 },
  { key: 'collidable', label: 'Collidable', width: 70 },
  { key: 'visible', label: 'Visible', width: 70 },
  { key: 'timerEnabled', label: 'Timer enabled', width: 70 },
  { key: 'depthBias', label: 'Depth Bias', width: 70 },
  { key: 'staticRendering', label: 'Static rendering', width: 70 },
  { key: 'reflections', label: 'Reflections enabled', width: 70 },
  { key: 'surface', label: 'Surface', width: 200 },
];

function isValidString(str: string | undefined | null): boolean {
  return !!str && str.trim().length > 0;
}

function joinWithSeparator(...values: (string | undefined | null)[]): string {
  return values.filter(v => isValidString(v)).join('--');
}

function getLayerPath(name: string, item: Record<string, unknown>): string {
  if (item._type === 'PartGroup') {
    return name;
  }
  const parent = (item.part_group_name || item._layerName) as string | undefined;
  if (parent && parent.trim()) {
    return parent + '/' + name;
  }
  return '';
}

function getCollectionForItem(itemName: string, collections: Collection[]): string {
  for (const col of collections) {
    if (col.items && col.items.includes(itemName)) {
      return col.name;
    }
  }
  return '';
}

function getItemData(name: string, item: Record<string, unknown>, collections: Collection[]): SelectElementItem {
  const rawType = item._type as string;
  const layer = getLayerPath(name, item);

  let type = rawType;
  let image = '';
  let material = '';
  let physicsMaterial = '';
  let collidable = '';
  let visible = '';
  let timerEnabled = '';
  let depthBias = '';
  let staticRendering = '';
  let reflections = '';
  let surface = '';

  switch (rawType) {
    case 'Wall':
      type = 'Wall';
      image = joinWithSeparator(item.image as string, item.side_image as string);
      material = joinWithSeparator(
        item.top_material as string,
        item.side_material as string,
        item.slingshot_material as string
      );
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.is_side_visible
        ? item.is_top_bottom_visible
          ? 'X'
          : 'S'
        : item.is_top_bottom_visible
          ? 'T'
          : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = 'N/A';
      staticRendering = item.is_static_rendering ? 'X' : ' ';
      reflections = 'N/A';
      surface = 'N/A';
      break;

    case 'Ramp':
      image = isValidString(item.image as string) ? (item.image as string) : '';
      material = isValidString(item.material as string) ? (item.material as string) : '';
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.is_visible ? 'X' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = ((item.depth_bias as number) ?? 0).toFixed(1);
      staticRendering = item.is_static_rendering !== false ? 'X' : ' ';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = 'N/A';
      break;

    case 'Flasher':
      image = joinWithSeparator(item.image_a as string, item.image_b as string);
      material = '';
      collidable = 'N/A';
      visible = item.is_visible ? 'X' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = ((item.depth_bias as number) ?? 0).toFixed(1);
      staticRendering = 'N/A';
      reflections = 'N/A';
      surface = 'N/A';
      break;

    case 'Rubber':
      image = isValidString(item.image as string) ? (item.image as string) : '';
      material = isValidString(item.material as string) ? (item.material as string) : '';
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.is_visible ? 'X' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = 'N/A';
      staticRendering = item.is_static_rendering ? 'X' : ' ';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = 'N/A';
      break;

    case 'Spinner':
      image = isValidString(item.image as string) ? (item.image as string) : '';
      material = isValidString(item.material as string) ? (item.material as string) : '';
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.is_visible ? (item.show_bracket ? 'X' : 'S') : item.show_bracket ? 'B' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = 'N/A';
      staticRendering = 'N/A';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = (item.surface as string) || '';
      break;

    case 'Kicker':
      image = '';
      material = isValidString(item.material as string) ? (item.material as string) : '';
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.kicker_type !== 'invisible' ? 'X' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = 'N/A';
      staticRendering = 'N/A';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = (item.surface as string) || '';
      break;

    case 'Light':
      image = isValidString(item.image as string) ? (item.image as string) : '';
      material = '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.visible ? 'X' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = ((item.depth_bias as number) ?? 0).toFixed(1);
      staticRendering = 'N/A';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = (item.surface as string) || '';
      break;

    case 'Bumper':
      image = '';
      material = joinWithSeparator(
        item.base_material as string,
        item.cap_material as string,
        item.skirt_material as string,
        item.ring_material as string
      );
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      {
        const fullyVisible =
          item.is_cap_visible && item.is_base_visible && item.is_ring_visible && item.is_skirt_visible;
        const partlyVisible =
          item.is_cap_visible || item.is_base_visible || item.is_ring_visible || item.is_skirt_visible;
        visible = fullyVisible ? 'X' : partlyVisible ? '/' : ' ';
      }
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = 'N/A';
      staticRendering = 'N/A';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = (item.surface as string) || '';
      break;

    case 'Flipper':
      image = isValidString(item.image as string) ? (item.image as string) : '';
      material = joinWithSeparator(item.material as string, item.rubber_material as string);
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.is_visible ? 'X' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = 'N/A';
      staticRendering = 'N/A';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = (item.surface as string) || '';
      break;

    case 'Gate':
      image = '';
      material = isValidString(item.material as string) ? (item.material as string) : '';
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.is_visible ? (item.show_bracket ? 'X' : 'W') : item.show_bracket ? 'B' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = 'N/A';
      staticRendering = 'N/A';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = (item.surface as string) || '';
      break;

    case 'Trigger':
      image = '';
      material = isValidString(item.material as string) ? (item.material as string) : '';
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.is_visible && item.shape !== 'none' ? 'X' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = 'N/A';
      staticRendering = 'N/A';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = (item.surface as string) || '';
      break;

    case 'Timer':
      image = '';
      material = '';
      break;

    case 'TextBox':
      image = '';
      material = '';
      break;

    case 'Plunger':
      image = isValidString(item.image as string) ? (item.image as string) : '';
      material = isValidString(item.material as string) ? (item.material as string) : '';
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.is_visible ? 'X' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = 'N/A';
      staticRendering = 'N/A';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = (item.surface as string) || '';
      break;

    case 'Reel':
      type = 'EMReel';
      image = isValidString(item.image as string) ? (item.image as string) : '';
      material = '';
      break;

    case 'Primitive':
      image = isValidString(item.image as string) ? (item.image as string) : '';
      material = isValidString(item.material as string) ? (item.material as string) : '';
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable && !item.is_toy ? 'X' : ' ';
      visible = item.is_visible ? 'X' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = ((item.depth_bias as number) ?? 0).toFixed(1);
      staticRendering = item.is_static_rendering ? 'X' : ' ';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = 'N/A';
      break;

    case 'HitTarget':
      type = 'Target';
      image = isValidString(item.image as string) ? (item.image as string) : '';
      material = isValidString(item.material as string) ? (item.material as string) : '';
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      collidable = item.is_collidable ? 'X' : ' ';
      visible = item.is_visible ? 'X' : ' ';
      timerEnabled = item.is_timer_enabled ? 'X' : ' ';
      depthBias = ((item.depth_bias as number) ?? 0).toFixed(1);
      staticRendering = 'N/A';
      reflections = item.is_reflection_enabled ? 'X' : ' ';
      surface = 'N/A';
      break;

    case 'Decal':
      image = isValidString(item.image as string) ? (item.image as string) : '';
      material = isValidString(item.material as string) ? (item.material as string) : '';
      physicsMaterial = isValidString(item.physics_material as string) ? (item.physics_material as string) : '';
      surface = (item.surface as string) || '';
      break;

    case 'LightSequencer':
      type = 'LightSeq';
      image = '';
      material = '';
      break;

    case 'PartGroup':
      image = '';
      material = '';
      break;

    case 'Ball':
      break;
  }

  const typesWithCollectionNA = [
    'Wall',
    'Ramp',
    'Flasher',
    'Rubber',
    'Spinner',
    'Kicker',
    'Light',
    'Bumper',
    'Flipper',
    'Gate',
    'Trigger',
    'Plunger',
    'Primitive',
    'HitTarget',
  ];
  const collection = typesWithCollectionNA.includes(rawType) ? getCollectionForItem(name, collections) : '';

  return {
    name,
    type,
    layer,
    image,
    material,
    physicsMaterial,
    collection,
    collidable,
    visible,
    timerEnabled,
    depthBias,
    staticRendering,
    reflections,
    surface,
    isCollection: false,
  };
}

export function initSelectElementComponent(
  container: HTMLElement,
  items: Record<string, Record<string, unknown>>,
  collections: Collection[],
  callbacks: SelectElementCallbacks
): { updateData: (items: Record<string, Record<string, unknown>>, collections: Collection[]) => void } {
  let tableData: SelectElementItem[] = [];
  let filteredData: SelectElementItem[] = [];
  let sortColumn = 0;
  let sortAscending = true;
  let shiftAnchorIndex = -1;

  container.innerHTML = `
    <div class="select-element-toolbar">
      <input type="text" class="select-element-filter" placeholder="Filter...">
      <div class="select-element-spacer"></div>
      <button class="win-btn primary select-element-btn-select">Select</button>
    </div>
    <div class="select-element-content">
      <div class="select-element-table-container">
        <table class="select-element-table">
          <thead>
            <tr>
              ${COLUMNS.map((col, i) => `<th data-col="${i}" style="width: ${col.width}px;">${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
    <div class="select-element-status">Ready</div>
  `;

  const filterInput = container.querySelector('.select-element-filter') as HTMLInputElement;
  const tbody = container.querySelector('.select-element-table tbody') as HTMLTableSectionElement;
  const statusBar = container.querySelector('.select-element-status') as HTMLElement;
  const selectBtn = container.querySelector('.select-element-btn-select') as HTMLButtonElement;
  const theadRow = container.querySelector('.select-element-table thead tr') as HTMLTableRowElement;

  function buildTableData(): void {
    tableData = [];

    for (const collection of collections) {
      tableData.push({
        name: collection.name,
        type: 'Collection',
        layer: '',
        image: '',
        material: '',
        physicsMaterial: '',
        collection: '',
        collidable: '',
        visible: '',
        timerEnabled: '',
        depthBias: '',
        staticRendering: '',
        reflections: '',
        surface: '',
        isCollection: true,
      });
    }

    for (const [name, item] of Object.entries(items)) {
      if (!name || !name.trim()) continue;
      tableData.push(getItemData(name, item, collections));
    }

    sortData();
  }

  function sortData(): void {
    const key = COLUMNS[sortColumn].key as keyof SelectElementItem;
    filteredData.sort((a, b) => {
      let valA: string | boolean = a[key] ?? '';
      let valB: string | boolean = b[key] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAscending ? -1 : 1;
      if (valA > valB) return sortAscending ? 1 : -1;
      return 0;
    });
  }

  function applyFilter(filter: string): void {
    const filterLower = filter.toLowerCase();
    if (!filterLower) {
      filteredData = [...tableData];
    } else {
      filteredData = tableData.filter(
        row =>
          row.name.toLowerCase().includes(filterLower) ||
          row.type.toLowerCase().includes(filterLower) ||
          row.layer.toLowerCase().includes(filterLower) ||
          row.collection.toLowerCase().includes(filterLower)
      );
    }
    sortData();
  }

  function renderTable(): void {
    const filter = filterInput.value;
    applyFilter(filter);

    tbody.innerHTML = '';
    shiftAnchorIndex = -1;

    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i];
      const tr = document.createElement('tr');
      tr.dataset.name = row.name;
      tr.dataset.isCollection = String(row.isCollection);
      tr.dataset.index = String(i);

      for (const col of COLUMNS) {
        const td = document.createElement('td');
        const value = row[col.key as keyof SelectElementItem] ?? '';
        td.textContent = String(value);
        td.title = String(value);
        tr.appendChild(td);
      }

      tr.addEventListener('click', e => {
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentIndex = rows.indexOf(tr);

        if (e.shiftKey && shiftAnchorIndex >= 0) {
          const start = Math.min(shiftAnchorIndex, currentIndex);
          const end = Math.max(shiftAnchorIndex, currentIndex);
          if (!e.ctrlKey && !e.metaKey) {
            rows.forEach(r => r.classList.remove('selected'));
          }
          for (let j = start; j <= end; j++) {
            rows[j].classList.add('selected');
          }
        } else if (e.ctrlKey || e.metaKey) {
          tr.classList.toggle('selected');
          shiftAnchorIndex = currentIndex;
        } else {
          rows.forEach(r => r.classList.remove('selected'));
          tr.classList.add('selected');
          shiftAnchorIndex = currentIndex;
        }

        updateStatus();
      });

      tr.addEventListener('dblclick', selectElements);

      tbody.appendChild(tr);
    }

    updateSortIndicators();
    updateStatus();
  }

  function updateStatus(): void {
    const selectedCount = tbody.querySelectorAll('tr.selected').length;
    const totalCount = filteredData.length;
    if (selectedCount > 0) {
      statusBar.textContent = `${selectedCount} of ${totalCount} elements selected`;
    } else {
      statusBar.textContent = `${totalCount} elements`;
    }
  }

  function updateSortIndicators(): void {
    theadRow.querySelectorAll('th').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (parseInt(th.dataset.col!) === sortColumn) {
        th.classList.add(sortAscending ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  function selectElements(): void {
    const selectedRows = tbody.querySelectorAll('tr.selected');
    if (selectedRows.length === 0) return;

    const names = Array.from(selectedRows).map(r => (r as HTMLElement).dataset.name!);
    const isCollection = (selectedRows[0] as HTMLElement).dataset.isCollection === 'true';

    if (isCollection && names.length === 1) {
      const collection = collections.find(c => c.name === names[0]);
      if (collection && collection.items?.length) {
        callbacks.onSelect(collection.items);
      }
    } else {
      callbacks.onSelect(names);
    }
    callbacks.onClose();
  }

  filterInput.addEventListener('input', () => renderTable());
  selectBtn.addEventListener('click', selectElements);

  theadRow.querySelectorAll('th').forEach(th => {
    th.addEventListener('click', () => {
      const col = parseInt(th.dataset.col!);
      if (sortColumn === col) {
        sortAscending = !sortAscending;
      } else {
        sortColumn = col;
        sortAscending = true;
      }
      renderTable();
    });
  });

  container.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      selectElements();
    } else if (e.key === 'Escape') {
      callbacks.onClose();
    }
  });

  buildTableData();
  renderTable();
  statusBar.textContent = `Loaded ${Object.keys(items).length} elements`;

  return {
    updateData: (newItems, newCollections) => {
      Object.assign(items, newItems);
      collections.length = 0;
      collections.push(...newCollections);
      buildTableData();
      renderTable();
    },
  };
}
