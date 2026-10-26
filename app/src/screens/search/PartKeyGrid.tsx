import { quantityLabel } from '../../lib/search';
import type { PartKey } from '../../lib/part-search';
import styles from './PartKeyGrid.module.css';

interface Props {
  keys: PartKey[];
  /** Las claves marcadas, de esta página y de las demás. */
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
}

/**
 * La lista previa de SRCH-01 (`preliminary-list`): una casilla por clave, en 4 columnas que se leen por filas.
 * La de más ofertas va arriba a la izquierda y la siguiente a su derecha; ese orden lo trae la RPC
 * (`search_part_keys`: ofertas desc, clave asc) y la rejilla no lo toca: CSS grid ya rellena por filas.
 *
 * Presentacional: ni carga ni guarda la selección. Cada celda enseña la clave normalizada, no la grafía de un
 * distribuidor (`design.md` §6, PO 25-oct-2026).
 */
export function PartKeyGrid({ keys, selected, onToggle }: Props) {
  return (
    <ul className={styles.grid} aria-label="Referencias encontradas">
      {keys.map(({ key, offers }) => {
        const marcada = selected.has(key);
        return (
          <li key={key} className={`${styles.cell} ${marcada ? styles.cellSelected : ''}`}>
            <label className={styles.label}>
              <input type="checkbox" checked={marcada} onChange={() => onToggle(key)} />
              <span className={styles.key}>{key}</span>
              <span className={styles.offers}>
                {offers === 1 ? '1 oferta' : `${quantityLabel(offers)} ofertas`}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
