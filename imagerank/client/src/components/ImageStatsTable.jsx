import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import { collectionColor, formatDuration, formatStat } from '../lib/analytics'

// Every image, ranked by how heavily processed the average subject preferred it
// (issue #59). Sortable on any column; each row links to the image's own page.
// Shared by the main analytics dashboard (all images) and each demographic
// breakdown page (one table per group value).
const IMAGE_TABLE_COLUMNS = [
  { key: 'image', label: 'Image', get: (image) => image.imageId, align: 'left' },
  { key: 'collection', label: 'Type', get: (image) => image.collectionId, align: 'left' },
  { key: 'rankings', label: 'Rankings', get: (image) => image.rankingCount ?? image.n ?? 0 },
  { key: 'time', label: 'Time judged', get: (image) => image.gradingMsMean },
  { key: 'favMin', label: 'Min', group: 'favorite', get: (image) => image.favorite?.min },
  { key: 'favMean', label: 'Mean', group: 'favorite', get: (image) => image.favorite?.mean },
  { key: 'favMax', label: 'Max', group: 'favorite', get: (image) => image.favorite?.max },
  { key: 'favStd', label: 'Std dev', group: 'favorite', get: (image) => image.favorite?.std },
  { key: 'realMin', label: 'Min', group: 'realism', get: (image) => image.realism?.min },
  { key: 'realMean', label: 'Mean', group: 'realism', get: (image) => image.realism?.mean },
  { key: 'realMax', label: 'Max', group: 'realism', get: (image) => image.realism?.max },
  { key: 'realStd', label: 'Std dev', group: 'realism', get: (image) => image.realism?.std },
]

export default function ImageStatsTable({ images }) {
  // Mean favorite level, highest first: the "ordered by mean ranking" default.
  const [sort, setSort] = useState({ key: 'favMean', dir: 'desc' })

  const sorted = useMemo(() => {
    const column = IMAGE_TABLE_COLUMNS.find((entry) => entry.key === sort.key)
    if (!column) {
      return images
    }
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...images].sort((a, b) => {
      const left = column.get(a)
      const right = column.get(b)
      // Images missing this stat always sink to the bottom, either direction.
      if (left == null && right == null) return 0
      if (left == null) return 1
      if (right == null) return -1
      if (typeof left === 'string' || typeof right === 'string') {
        return String(left).localeCompare(String(right)) * factor
      }
      return (left - right) * factor
    })
  }, [images, sort])

  const toggle = useCallback((key) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'image' || key === 'collection' ? 'asc' : 'desc' },
    )
  }, [])

  if (images.length === 0) {
    return <Alert severity="info">No images have been ranked yet.</Alert>
  }

  return (
    <div className="admin-table-wrap analytics-image-table-wrap">
      <table className="admin-table analytics-image-table">
        <thead>
          <tr>
            <th colSpan={4} />
            <th colSpan={4} className="analytics-group-head">Favorite image level</th>
            <th colSpan={4} className="analytics-group-head">Most realistic level</th>
          </tr>
          <tr>
            {IMAGE_TABLE_COLUMNS.map((column) => (
              <th
                key={column.key}
                className={column.align === 'left' ? undefined : 'admin-num'}
                aria-sort={sort.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button type="button" className="analytics-sort-button" onClick={() => toggle(column.key)}>
                  {column.label}
                  {sort.key === column.key ? <span aria-hidden="true">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span> : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((image) => (
            <tr key={`${image.collectionId}/${image.imageId}`}>
              <td>
                <Link
                  className="analytics-image-link"
                  to={`/admin/images/${encodeURIComponent(image.collectionId)}/${encodeURIComponent(image.imageId)}`}
                >
                  {image.imageId}
                </Link>
              </td>
              <td>
                <span className="admin-collection-chip" style={{ background: collectionColor(image.collectionId) }}>
                  {image.collectionId}
                </span>
              </td>
              <td className="admin-num">{image.rankingCount ?? image.n ?? 0}</td>
              <td className="admin-num">{formatDuration(image.gradingMsMean)}</td>
              <td className="admin-num">{formatStat(image.favorite?.min, 0)}</td>
              <td className="admin-num">{formatStat(image.favorite?.mean)}</td>
              <td className="admin-num">{formatStat(image.favorite?.max, 0)}</td>
              <td className="admin-num">{formatStat(image.favorite?.std)}</td>
              <td className="admin-num">{formatStat(image.realism?.min, 0)}</td>
              <td className="admin-num">{formatStat(image.realism?.mean)}</td>
              <td className="admin-num">{formatStat(image.realism?.max, 0)}</td>
              <td className="admin-num">{formatStat(image.realism?.std)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
