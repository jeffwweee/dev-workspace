# Staff Portal Bug Fixes & Enhancements - Design Document

**Date:** 2026-02-25
**Status:** Design Approved - Pending Implementation
**Projects:** bblsg-staffportal-ui, bblsg-staffportal
**Branch:** release/mvp2

---

## Overview

This document describes bug fixes and small enhancements for the Staff Portal application, addressing issues identified in the last meeting. Changes span both frontend (Next.js) and backend (Spring Boot) components.

---

## Change Summary

| # | Area | Description | Complexity |
|---|------|-------------|------------|
| 1 | Remittance Trends | Year-filtered summary cards + hide future months | Low |
| 2 | Remittance Chart | Month click modal with transaction breakdown | Medium |
| 3 | Expiring Soon | Row-level "X days left" badge (≤7 days) | Low |
| 4 | Deposits Search | Deal-type handling (DF vs others) | Medium |
| 5 | FX Data | Backend dedupe by dealId (most recent first) | Low |

---

## 1. Remittance Volume & Trends - Year Filtering

**Frontend File:** `src/components/Customer/RemittanceTab.tsx`

### Current Behavior
- Summary cards show ALL historical remittances regardless of year selection
- Chart shows all 12 months even for future months in current year

### Desired Behavior
- Summary cards filter by selected year
- Chart hides future months (e.g., if FEB, hide MAR-DEC)

### Implementation

```typescript
// Filter summary by selected year
const summary = useMemo(() => {
  // Add year filter FIRST
  const yearFilteredRemittances = remittances.filter(r => {
    const dateParts = getDateParts(r.valueDate);
    return dateParts?.year === selectedYear;
  });

  const inward = yearFilteredRemittances.filter(r => r.direction === 'INWARD');
  const outward = yearFilteredRemittances.filter(r => r.direction === 'OUTWARD');

  // ... rest of calculation
}, [remittances, selectedYear]);

// Hide future months in chart
const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

const visibleTrendData = useMemo(() => {
  return trendData.filter(t => {
    if (selectedYear < currentYear) return true; // Past years - show all
    const month = parseInt(t.month.split('-')[1]);
    return month <= currentMonth; // Current year - hide future
  });
}, [trendData, selectedYear, currentYear, currentMonth]);
```

### Edge Cases
- Year boundary transitions (Dec/Jan)
- Leap years
- Future years with no data

---

## 2. Remittance Chart - Transaction Breakdown Modal

**Frontend File:** `src/components/Customer/RemittanceTab.tsx`

### Current Behavior
- Hover on chart shows only total USD/SGD amount
- No way to see individual transactions

### Desired Behavior
- Click on month → Opens modal with Inward/Outward tabs
- Each tab shows list of transactions for that month
- Similar style to existing Customer detail modals

### Implementation

```typescript
// New state
const [monthDetailOpen, setMonthDetailOpen] = useState(false);
const [monthDetailTab, setMonthDetailTab] = useState(0);
const [selectedMonthData, setSelectedMonthData] = useState<{
  year: number;
  month: number;
  monthLabel: string;
  inward: CustomerRemittance[];
  outward: CustomerRemittance[];
} | null>(null);

// Click handler for chart
const handleMonthClick = (_: any, event: any) => {
  const dataIndex = event.dataIndex;
  const monthData = trendData[dataIndex];
  const month = parseInt(monthData.month.split('-')[1]);

  // Filter remittances for this month/year
  const monthRemittances = remittances.filter(r => {
    const dateParts = getDateParts(r.valueDate);
    return dateParts?.year === selectedYear && dateParts?.month === month;
  });

  setSelectedMonthData({
    year: selectedYear,
    month,
    monthLabel: monthData.monthLabel,
    inward: monthRemittances.filter(r => r.direction === 'INWARD'),
    outward: monthRemittances.filter(r => r.direction === 'OUTWARD'),
  });
  setMonthDetailOpen(true);
};

// Update LineChart with onClick
<LineChart
  dataset={chartData}
  onClick={handleMonthClick}
  // ... rest of props
/>

// Modal component (similar to Customer detail modals)
<Dialog
  open={monthDetailOpen}
  onClose={() => setMonthDetailOpen(false)}
  maxWidth="xl"
  fullWidth
>
  <DialogTitle>
    Remittance Details - {selectedMonthData?.monthLabel}
  </DialogTitle>
  <DialogContent>
    <Tabs value={monthDetailTab} onChange={(_, v) => setMonthDetailTab(v)}>
      <Tab label={`Inward (${selectedMonthData?.inward.length || 0})`} />
      <Tab label={`Outward (${selectedMonthData?.outward.length || 0})`} />
    </Tabs>
    <Box sx={{ mt: 2 }}>
      {monthDetailTab === 0 && (
        <RemittanceTable data={selectedMonthData?.inward || []} />
      )}
      {monthDetailTab === 1 && (
        <RemittanceTable data={selectedMonthData?.outward || []} />
      )}
    </Box>
  </DialogContent>
</Dialog>
```

### Edge Cases
- Month with no transactions
- Large transaction counts (consider pagination if >50)
- Tab switching preserves state

---

## 3. Expiring Soon - Dynamic Days Badge

**Frontend Files:**
- `src/app/search-new/page.tsx`
- `src/components/Customer/FacilityTable.tsx` (if applicable)

### Current Behavior
- "Expiring Soon (7d)" hardcoded text in metrics section
- No row-level indicators

### Desired Behavior
- Filter label: "Expiring Soon" (remove "(7d)")
- Row-level badge showing "X days left" when ≤7 days remaining
- Filter logic still uses 7-day threshold

### Implementation

```typescript
// Utility function (add to utils.ts)
export const getDaysRemaining = (maturityDate: string | null): number | null => {
  if (!maturityDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maturity = parseMaturityDate(maturityDate);
  if (!maturity) return null;

  const diffTime = maturity.getTime() - today.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return days;
};

// Filter checkbox (remove "(7d)")
<FormControlLabel
  control={<Checkbox checked={filters.expiringSoon} />}
  label="Expiring Soon"
/>

// Row-level badge (only when ≤7 days)
{(() => {
  const daysLeft = getDaysRemaining(row.maturityDate);
  if (daysLeft !== null && daysLeft <= 7) {
    return (
      <Chip
        label={`${daysLeft} days left`}
        size="small"
        color={daysLeft <= 3 ? 'error' : 'warning'}
        sx={{ fontSize: '0.75rem' }}
      />
    );
  }
  return null;
})()}
```

### Color Coding
| Days Remaining | Color |
|----------------|-------|
| 0-3 days | error (red) |
| 4-7 days | warning (orange) |
| 8+ days | no badge |

### Edge Cases
- Past maturity (negative days) - could show "Expired"
- Null maturity date - no badge
- Exactly 7 days - show badge

---

## 4. Deposits Search - Deal Type Handling

### 4a. Backend Changes

**Files:**
- `src/main/java/.../financials/service/impl/FinancialSearchServiceImpl.java`
- `src/main/java/.../gateway/dto/request/FinancialSearchRequest.java`

**Deal Types:**
- **DF** = Demand Draft/Fixed Deposit (has maturity dates)
- **CA/DO/DQ/DS/DV** = Other deposits (no maturity dates)

```java
// Request DTO - make maturityDate nullable
public class FinancialSearchRequest {
    private String dealType;  // CA, DF, DO, DQ, DS, DV

    @Nullable
    private String maturityDate;  // Only used for DF

    // ... other fields
}

// Service implementation
public List<FinancialSearchDeposit> searchDeposits(FinancialSearchRequest request) {
    List<FinancialSearchDeposit> deposits;

    if ("DF".equals(request.getDealType())) {
        // DF: Apply maturity date filter if provided
        if (request.getMaturityDate() != null) {
            deposits = repository.findByDealTypeAndMaturityDate(
                request.getDealType(),
                request.getMaturityDate()
            );
        } else {
            // DF without maturity date - return all DF
            deposits = repository.findByDealType(request.getDealType());
        }
    } else {
        // CA, DO, DQ, DS, DV: No maturity date filtering
        deposits = repository.findByDealType(request.getDealType());
    }

    return deposits;
}
```

### 4b. Frontend Changes

**Files:**
- `src/app/search-new/page.tsx`
- `src/types/search.ts`

```typescript
// Conditional maturity date picker
{dealType === 'DF' && (
  <DatePicker
    label="Maturity Date"
    value={maturityDate}
    onChange={setMaturityDate}
  />
)}

// Conditional column rendering
{dealType === 'DF' ? (
  <TableCell>Loan Details</TableCell>
) : (
  <TableCell>Account Number</TableCell>
)}

{dealType === 'DF' ? (
  <TableCell>{row.loanDetails}</TableCell>
) : (
  <TableCell>{row.accountNumber}</TableCell>
)}

// Frontend filter for DF (optional - if backend doesn't filter)
const filteredDeposits = useMemo(() => {
  let result = deposits;

  // For DF, apply frontend maturity filter if date selected
  if (dealType === 'DF' && maturityDate) {
    result = result.filter(d => {
      // Parse and compare maturity dates
    });
  }

  return result;
}, [deposits, dealType, maturityDate]);
```

### UI Behavior Summary

| Deal Type | Maturity Date Picker | Display Column | Filter Logic |
|-----------|---------------------|----------------|--------------|
| DF | Visible | Loan Details | Backend + Frontend |
| CA/DO/DQ/DS/DV | Hidden | Account Number | Backend only |

---

## 5. FX Data - Distinct Deal ID Deduplication

**Backend File:**
- `src/main/java/.../datavisization/service/impl/CustomerDetailsServiceImpl.java`

**Entity:** `BBLSGFxValuation`

### Current Behavior
- FX data may contain duplicate dealIds
- Each duplicate renders as separate row

### Desired Behavior
- Dedupe by `dealId`
- Keep **most recent** record
- If most recent is dupe, keep **first** occurrence

### Implementation

```java
public List<CustomerFx> getCustomerFxTransactions(String basicNumber) {
    List<BBLSGFxValuation> fxList = fxValuationRepository.findByBasicNumber(basicNumber);

    // Sort by dealDate descending (most recent first)
    fxList.sort((a, b) -> {
        if (a.getDealDate() == null) return 1;
        if (b.getDealDate() == null) return -1;
        return b.getDealDate().compareTo(a.getDealDate());
    });

    // Dedupe by dealId - LinkedHashSet preserves order
    Set<String> seenDealIds = new HashSet<>();
    List<BBLSGFxValuation> distinctFx = new ArrayList<>();

    for (BBLSGFxValuation fx : fxList) {
        if (seenDealIds.add(fx.getDealId())) {
            distinctFx.add(fx);  // First occurrence (most recent due to sort)
        }
    }

    return distinctFx.stream()
        .map(this::mapToCustomerFx)
        .collect(Collectors.toList());
}
```

### Alternative (using Stream with proper ordering):

```java
public List<CustomerFx> getCustomerFxTransactions(String basicNumber) {
    List<BBLSGFxValuation> fxList = fxValuationRepository.findByBasicNumber(basicNumber);

    // Sort by dealDate DESC, then dedupe by dealId keeping first
    return fxList.stream()
        .sorted(Comparator.comparing(
            BBLSGFxValuation::getDealDate,
            Comparator.nullsLast(Comparator.reverseOrder())
        ))
        .collect(Collectors.toMap(
            BBLSGFxValuation::getDealId,
            fx -> fx,
            (existing, duplicate) -> existing,  // Keep first (most recent)
            LinkedHashMap::new  // Preserve order
        ))
        .values()
        .stream()
        .map(this::mapToCustomerFx)
        .collect(Collectors.toList());
}
```

---

## Testing Checklist

### 1. Remittance Year Filter
- [ ] Select past year → summary shows only that year's data
- [ ] Select current year → future months hidden in chart
- [ ] Switch between years → summary updates correctly
- [ ] Year with no data → shows zero/empty state

### 2. Month Detail Modal
- [ ] Click on month with data → modal opens
- [ ] Inward tab shows correct transactions
- [ ] Outward tab shows correct transactions
- [ ] Month with no transactions → empty state
- [ ] Close modal → state cleared

### 3. Expiring Soon Badge
- [ ] 3 days left → red badge "3 days left"
- [ ] 5 days left → orange badge "5 days left"
- [ ] 7 days left → orange badge "7 days left"
- [ ] 8 days left → no badge
- [ ] No maturity date → no badge
- [ ] Expired (negative days) → consider "Expired" badge

### 4. Deposits Deal Type
- [ ] Select DF → maturity date picker visible
- [ ] Select CA → maturity date picker hidden
- [ ] DF results → show Loan Details column
- [ ] CA results → show Account Number column
- [ ] Switch deal types → UI updates correctly

### 5. FX Dedupe
- [ ] Verify dealId uniqueness in response
- [ ] Most recent record kept
- [ ] Total count reduced (if duplicates existed)

---

## Implementation Order

1. **FX Dedupe** (Backend) - Lowest risk, isolated change
2. **Deposits Deal Type** (Backend) - Foundation for frontend work
3. **Remittance Year Filter** (Frontend) - Isolated component change
4. **Expiring Soon Badge** (Frontend) - UI-only change
5. **Deposits UI Updates** (Frontend) - Depends on backend
6. **Month Detail Modal** (Frontend) - Most complex, depends on stable data

---

## Open Questions

- [ ] Should expired deposits (past maturity) show a different badge style?
- [ ] For FX dedupe, what field determines "most recent"? (dealDate, valueDate, created_at?)
- [ ] Should month detail modal support export/print functionality?

---

## Next Steps

Once this design is approved:
1. Invoke `writing-plans` skill to create detailed implementation plan
2. Create task list with dependencies
3. Begin implementation following the order above
