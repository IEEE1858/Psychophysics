import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import { EMPTY_FILTERS } from '../lib/analytics'

// Shared demographic/condition filter bar for every admin analytics page
// (the main dashboard and each per-dimension breakdown page), so a filter
// added once is available everywhere it applies.

// Multi-select filter with chip display, backed by a fixed option list from
// the server's filterOptions (only demographic values actually present in the
// data are offered).
function MultiFilter({ label, value, options, onChange }) {
  if (options.length === 0) {
    return null
  }
  return (
    <FormControl size="small" className="analytics-filter-control" sx={{ width: 130, minWidth: 130 }}>
      <InputLabel id={`${label}-filter-label`}>{label}</InputLabel>
      <Select
        labelId={`${label}-filter-label`}
        multiple
        value={value}
        onChange={(event) => onChange(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) => (
          <div className="analytics-filter-chips">
            {selected.map((item) => (
              <Chip key={item} label={item} size="small" />
            ))}
          </div>
        )}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

// The filter section: header (with a refresh spinner + clear button) plus the
// row of age fields and multi-selects. `dimensionKey` hides that dimension's
// own multi-select on its breakdown page (filtering "Gender" while already
// grouping by gender would just thin out each group's own bucket).
export function AnalyticsFilterBar({ filters, setFilters, filterOptions, refreshing, hasActiveFilters, dimensionKey }) {
  return (
    <section className="analytics-section">
      <div className="analytics-filter-head">
        <h2 className="admin-detail-subtitle">Filters</h2>
        {refreshing ? <CircularProgress size={16} /> : null}
        {hasActiveFilters ? (
          <Button size="small" variant="text" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="analytics-filter-row">
        <TextField
          size="small"
          type="number"
          label="Age min"
          value={filters.ageMin}
          onChange={(event) => setFilters((prev) => ({ ...prev, ageMin: event.target.value }))}
          className="analytics-filter-control analytics-filter-age"
          sx={{ width: 130, minWidth: 130 }}
          slotProps={{ htmlInput: { min: 0, max: 120 } }}
        />
        <TextField
          size="small"
          type="number"
          label="Age max"
          value={filters.ageMax}
          onChange={(event) => setFilters((prev) => ({ ...prev, ageMax: event.target.value }))}
          className="analytics-filter-control analytics-filter-age"
          sx={{ width: 130, minWidth: 130 }}
          slotProps={{ htmlInput: { min: 0, max: 120 } }}
        />
        {dimensionKey !== 'gender' ? (
          <MultiFilter
            label="Gender"
            value={filters.genders}
            options={filterOptions.genders}
            onChange={(next) => setFilters((prev) => ({ ...prev, genders: next }))}
          />
        ) : null}
        {dimensionKey !== 'country' ? (
          <MultiFilter
            label="Country"
            value={filters.countries}
            options={filterOptions.countries}
            onChange={(next) => setFilters((prev) => ({ ...prev, countries: next }))}
          />
        ) : null}
        {dimensionKey !== 'vision-degredation' ? (
          <MultiFilter
            label="Vision"
            value={filters.visionStatuses}
            options={filterOptions.visionStatuses}
            onChange={(next) => setFilters((prev) => ({ ...prev, visionStatuses: next }))}
          />
        ) : null}
        {dimensionKey !== 'imaging-expert' ? (
          <MultiFilter
            label="Expertise"
            value={filters.expertise}
            options={['expert', 'layperson']}
            onChange={(next) => setFilters((prev) => ({ ...prev, expertise: next }))}
          />
        ) : null}
        {dimensionKey !== 'display' ? (
          <MultiFilter
            label="Display"
            value={filters.displayTypes}
            options={filterOptions.displayTypes}
            onChange={(next) => setFilters((prev) => ({ ...prev, displayTypes: next }))}
          />
        ) : null}
        {dimensionKey !== 'lighting' ? (
          <MultiFilter
            label="Lighting"
            value={filters.lightingConditions}
            options={filterOptions.lightingConditions}
            onChange={(next) => setFilters((prev) => ({ ...prev, lightingConditions: next }))}
          />
        ) : null}
        {dimensionKey !== 'color-blindness' ? (
          <MultiFilter
            label="Color blind"
            value={filters.colorBlind}
            options={filterOptions.colorBlind}
            onChange={(next) => setFilters((prev) => ({ ...prev, colorBlind: next }))}
          />
        ) : null}
      </div>
    </section>
  )
}
