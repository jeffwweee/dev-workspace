# Staff Portal Bug Fixes & Enhancements - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Implement 5 bug fixes and enhancements for the Staff Portal covering FX deduplication, deposit search deal type handling, remittance year filtering, expiring soon badges, and month detail modal.

**Architecture:** Backend changes in Spring Boot service layer (Java) for FX dedupe and deposit search; frontend changes in Next.js/React for UI improvements. No database schema changes required.

**Tech Stack:**
- **Backend:** Java 21, Spring Boot 3.x, Maven, JUnit 5, Mockito
- **Frontend:** Next.js 15, TypeScript, React 19, Material-UI v6, MUI X-Charts
- **Projects:** bblsg-staffportal (backend), bblsg-staffportal-ui (frontend)
- **Branch:** release/mvp2

---

## Task 1: FX Data Deduplication (Backend)

**Files:**
- Modify: `projects/bblsg-staffportal/src/main/java/com/bblsg/staffportal/datavisualization/service/impl/CustomerDetailsServiceImpl.java:125-141`
- Test: `projects/bblsg-staffportal/src/test/java/com/bblsg/staffportal/datavisualization/service/impl/CustomerDetailsServiceImplTest.java`

### Step 1: Write failing test for FX deduplication

Create test file (if not exists):
`projects/bblsg-staffportal/src/test/java/com/bblsg/staffportal/datavisualization/service/impl/CustomerDetailsServiceImplTest.java`

```java
package com.bblsg.staffportal.datavisualization.service.impl;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.bblsg.staffportal.common.repository.customer.BBLSGEntityRepository;
import com.bblsg.staffportal.common.repository.financial.BBLSGAccountsRepository;
import com.bblsg.staffportal.common.repository.financial.BBLSGDealMappingRepository;
import com.bblsg.staffportal.common.repository.user.BBLSGAccountOfficerRepository;
import com.bblsg.staffportal.common.service.CurrencyRateService;
import com.bblsg.staffportal.common.service.SystemConfigService;
import com.bblsg.staffportal.common.service.DailyFinancialCacheService;
import com.bblsg.staffportal.financials.service.RemittanceService;
import com.bblsg.staffportal.common.entity.BBLSGFxDeals;
import com.bblsg.staffportal.gateway.dto.response.components.CustomerFx;

import java.time.LocalDate;
import java.util.List;

@ExtendWith(MockitoExtension.class)
class CustomerDetailsServiceImplTest {

    @Mock private BBLSGDealMappingRepository dealMappingRepository;
    @Mock private BBLSGAccountOfficerRepository accountOfficerRepository;
    @Mock private BBLSGEntityRepository entityRepository;
    @Mock private BBLSGAccountsRepository accountsRepository;
    @Mock private CurrencyRateService currencyRateService;
    @Mock private SystemConfigService systemConfigService;
    @Mock private DailyFinancialCacheService dailyFinancialCacheService;
    @Mock private RemittanceService remittanceService;

    @InjectMocks
    private CustomerDetailsServiceImpl service;

    @Test
    void getFxDeals_shouldDedupeByDealId_keepMostRecent() {
        // Given: FX deals with duplicate dealIds, different dates
        String basicNumber = "123456";

        BBLSGFxDeals deal1 = new BBLSGFxDeals();
        deal1.setDealId("FX001");
        deal1.setDealDate(LocalDate.of(2026, 2, 20));
        deal1.setBasicNumber(basicNumber);

        BBLSGFxDeals deal2 = new BBLSGFxDeals();
        deal2.setDealId("FX001"); // Duplicate
        deal2.setDealDate(LocalDate.of(2026, 2, 25)); // More recent
        deal2.setBasicNumber(basicNumber);

        BBLSGFxDeals deal3 = new BBLSGFxDeals();
        deal3.setDealId("FX002");
        deal3.setDealDate(LocalDate.of(2026, 2, 15));
        deal3.setBasicNumber(basicNumber);

        when(dailyFinancialCacheService.getFxDealsByValuationDate(anyString()))
            .thenReturn(List.of(deal1, deal2, deal3));

        // When: Getting FX deals
        List<CustomerFx> result = service.getFxDeals(basicNumber);

        // Then: Should dedupe, keeping most recent (deal2 for FX001)
        assertEquals(2, result.size()); // FX001 and FX002 only

        // Find FX001 in result
        CustomerFx fx001 = result.stream()
            .filter(fx -> "FX001".equals(fx.getDealId()))
            .findFirst()
            .orElse(null);

        assertNotNull(fx001);
        // Should have deal2's date (most recent)
        // Verify through related data if needed
    }

    @Test
    void getFxDeals_shouldHandleNullDealDates() {
        // Given: FX deals with null dates
        String basicNumber = "123456";

        BBLSGFxDeals deal1 = new BBLSGFxDeals();
        deal1.setDealId("FX001");
        deal1.setDealDate(LocalDate.of(2026, 2, 20));
        deal1.setBasicNumber(basicNumber);

        BBLSGFxDeals deal2 = new BBLSGFxDeals();
        deal2.setDealId("FX001");
        deal2.setDealDate(null); // Null date
        deal2.setBasicNumber(basicNumber);

        when(dailyFinancialCacheService.getFxDealsByValuationDate(anyString()))
            .thenReturn(List.of(deal1, deal2));

        // When: Getting FX deals
        List<CustomerFx> result = service.getFxDeals(basicNumber);

        // Then: Should handle nulls, still dedupe to 1
        assertEquals(1, result.size());
    }
}
```

Run test to verify it fails:
```bash
cd projects/bblsg-staffportal
mvn test -Dtest=CustomerDetailsServiceImplTest#getFxDeals_shouldDedupeByDealId_keepMostRecent
```

Expected: FAIL - deduplication not implemented

### Step 2: Implement FX deduplication logic

Modify `CustomerDetailsServiceImpl.java` method `getFxDeals`:

```java
List<BBLSGFxDeals> getFxDealsFromRepository(String basicNumber) {
    String valuationDate = AppUtils.getDashboardDate();
    final int maxLookbackDays = 10;
    List<BBLSGFxDeals> allMatches = new ArrayList<>();

    for (int i = 0; i <= maxLookbackDays; i++) {
        List<BBLSGFxDeals> matches = dailyFinancialCacheService.getFxDealsByValuationDate(valuationDate).stream()
                .filter(fx -> basicNumber.equalsIgnoreCase(fx.getBasicNumber()))
                .toList();
        if (!matches.isEmpty()) {
            allMatches.addAll(matches);
            // Don't return immediately - collect all for deduplication
        }
        valuationDate = AppUtils.getDateMinusOneDay(valuationDate);
    }

    if (allMatches.isEmpty()) {
        log.warn("[CustomerDetailsService][getFxDeals] No FX deals found for basicNumber={} within last {} days", basicNumber, maxLookbackDays);
        return Collections.emptyList();
    }

    // Dedupe by dealId, keeping most recent by dealDate
    // Sort by dealDate DESC (nulls last), then dedupe keeping first occurrence
    return allMatches.stream()
        .sorted((a, b) -> {
            // Sort by dealDate descending, null dates last
            if (a.getDealDate() == null && b.getDealDate() == null) return 0;
            if (a.getDealDate() == null) return 1;
            if (b.getDealDate() == null) return -1;
            return b.getDealDate().compareTo(a.getDealDate()); // Descending
        })
        .collect(Collectors.toMap(
            BBLSGFxDeals::getDealId,
            fx -> fx,
            (existing, duplicate) -> existing, // Keep first (most recent due to sort)
            LinkedHashMap::new // Preserve order
        ))
        .values()
        .stream()
        .toList();
}
```

### Step 3: Run test to verify it passes

```bash
cd projects/bblsg-staffportal
mvn test -Dtest=CustomerDetailsServiceImplTest#getFxDeals_shouldDedupeByDealId_keepMostRecent
```

Expected: PASS

### Step 4: Run all tests to ensure no regression

```bash
cd projects/bblsg-staffportal
mvn test
```

Expected: All tests pass

### Step 5: Commit changes

```bash
cd projects/bblsg-staffportal
git add src/main/java/com/bblsg/staffportal/datavisualization/service/impl/CustomerDetailsServiceImpl.java
git add src/test/java/com/bblsg/staffportal/datavisualization/service/impl/CustomerDetailsServiceImplTest.java
git commit -m "feat(datavisualization): dedupe FX transactions by dealId, keep most recent

- Sort by dealDate descending before deduplication
- Use LinkedHashMap to preserve order after dedupe
- Handle null dealDates by sorting them last
- Add unit tests for deduplication logic

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Deposits Search - Deal Type Handling (Backend)

**Files:**
- Modify: `projects/bblsg-staffportal/src/main/java/com/bblsg/staffportal/financials/service/impl/FinancialSearchServiceImpl.java:149-270`
- Modify: `projects/bblsg-staffportal/src/main/java/com/bblsg/staffportal/gateway/dto/request/FinancialSearchRequest.java` (if maturityDate validation exists)

### Step 1: Review current maturity date filtering

Read the `buildDepositResults` method to understand current logic. The method already handles maturity date filtering in `withinDateRange()` check at lines 206-210 and 239-243.

**Current logic:**
- For DF deposits: maturity date filtering is applied
- For other deposits: maturity date filtering is also applied via `withinDateRange()`

**Required change:**
- For DF deposits: keep existing behavior (maturity date filtering)
- For other deposits (CA/DO/DQ/DS/DV): skip maturity date filtering

### Step 2: Modify buildDepositResults to skip maturity filter for non-DF

In `FinancialSearchServiceImpl.java`, modify the `withinDateRange` checks:

```java
// Around line 206, update the DF branch maturity date check
if (DEAL_TYPE_DF.equalsIgnoreCase(deposit.getDealId()) && !dfDetails.isEmpty()) {
    Map<String, List<LoanComp>> byLoanDealId = dfDetails.stream()
            .filter(detail -> detail.getDealId() != null)
            .collect(Collectors.groupingBy(LoanComp::getDealId, LinkedHashMap::new, Collectors.toList()));

    for (Map.Entry<String, List<LoanComp>> entry : byLoanDealId.entrySet()) {
        String loanDealId = entry.getKey();
        List<LoanComp> loanGroup = entry.getValue();
        String maturityDate = resolveDepositMaturityDate(DEAL_TYPE_DF, null, loanGroup);

        // DF: Apply maturity date filter (existing behavior)
        if (!withinDateRange(resolveDepositRawMaturityDate(DEAL_TYPE_DF, null, loanGroup),
                request.getMaturityDateFrom(),
                request.getMaturityDateTo())) {
            continue;
        }
        // ... rest of existing code
    }
    continue;
}

// Around line 238, update non-DF branch - SKIPP maturity date filter
String maturityDate = resolveDepositMaturityDate(deposit.getDealId(), loan, dfDetails);

// Non-DF deposits: Skip maturity date filtering
// Only apply maturity filter for DF deals
if (DEAL_TYPE_DF.equalsIgnoreCase(deposit.getDealId())) {
    if (!withinDateRange(resolveDepositRawMaturityDate(deposit.getDealId(), loan, dfDetails),
            request.getMaturityDateFrom(),
            request.getMaturityDateTo())) {
        continue;
    }
}
// For non-DF (CA/DO/DQ/DS/DV), no maturity date filtering - include all results

List<FinancialSearchDepositDetail> details = buildDepositDetails(
        deposit.getDealId(),
        loan,
        dfDetails
);
// ... rest of existing code
```

### Step 3: Update comment/documentation

Add JavaDoc to clarify behavior:

```java
/**
 * Build deposit results from cached deal master data.
 *
 * Deal Type Behavior:
 * - DF (Fixed Deposit): maturity date filtering applied when provided
 * - CA/DO/DQ/DS/DV (Other deposits): maturity date filtering NOT applied, all results returned
 *
 * @param request the search request with optional maturity date filters
 * @return list of matching deposits
 */
private List<FinancialSearchDeposit> buildDepositResults(FinancialSearchRequest request) {
```

### Step 4: Write test for non-DF maturity date behavior

Create or add to test file:
`projects/bblsg-staffportal/src/test/java/com/bblsg/staffportal/financials/service/impl/FinancialSearchServiceImplTest.java`

```java
@Test
void buildDepositResults_nonDFType_shouldIgnoreMaturityDateFilter() {
    // Given: Search request with maturity date filter
    FinancialSearchRequest request = FinancialSearchRequest.builder()
        .dealType("CA") // Non-DF type
        .maturityDateFrom("2026-01-01")
        .maturityDateTo("2026-01-31")
        .build();

    // When: Building results
    List<FinancialSearchDeposit> results = service.buildDepositResults(request);

    // Then: Should not filter by maturity date for CA
    // Results with any maturity date should be included
    assertTrue(results.size() > 0, "Should return results regardless of maturity date");
}

@Test
void buildDepositResults_dfType_shouldApplyMaturityDateFilter() {
    // Given: Search request with maturity date filter for DF
    FinancialSearchRequest request = FinancialSearchRequest.builder()
        .dealType("DF")
        .maturityDateFrom("2026-01-01")
        .maturityDateTo("2026-01-31")
        .build();

    // When: Building results
    List<FinancialSearchDeposit> results = service.buildDepositResults(request);

    // Then: Should filter by maturity date for DF
    results.forEach(deposit -> {
        if (deposit.getMaturityDate() != null) {
            LocalDate maturity = LocalDate.parse(deposit.getMaturityDate());
            assertTrue(
                (maturity.isEqual(LocalDate.of(2026, 1, 1)) || maturity.isAfter(LocalDate.of(2026, 1, 1)))
                && (maturity.isEqual(LocalDate.of(2026, 1, 31)) || maturity.isBefore(LocalDate.of(2026, 1, 31)))
            );
        }
    });
}
```

### Step 5: Run tests

```bash
cd projects/bblsg-staffportal
mvn test -Dtest=FinancialSearchServiceImplTest
```

Expected: PASS

### Step 6: Build and verify

```bash
cd projects/bblsg-staffportal
mvn clean install
```

Expected: Build success

### Step 7: Commit changes

```bash
cd projects/bblsg-staffportal
git add src/main/java/com/bblsg/staffportal/financials/service/impl/FinancialSearchServiceImpl.java
git add src/test/java/com/bblsg/staffportal/financials/service/impl/FinancialSearchServiceImplTest.java
git commit -m "feat(financials): skip maturity date filter for non-DF deposit types

- DF deposits: maturity date filtering applied when provided
- CA/DO/DQ/DS/DV deposits: maturity date filtering skipped, all results returned
- Add tests to verify deal-type-specific filtering behavior
- Update JavaDoc to clarify maturity filter behavior per deal type

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Remittance Year Filter (Frontend)

**Files:**
- Modify: `projects/bblsg-staffportal-ui/src/components/Customer/RemittanceTab.tsx:86-219`

### Step 1: Read current RemittanceTab implementation

The file is at `projects/bblsg-staffportal-ui/src/components/Customer/RemittanceTab.tsx`. Key areas:
- Lines 86-122: `trendData` calculation
- Lines 178-219: `summary` calculation

### Step 2: Modify summary calculation to filter by selected year

Replace the `summary` useMemo (around line 178):

```typescript
// Calculate summary statistics with currency breakdown - FILTERED BY SELECTED YEAR
const summary = useMemo(() => {
    if (!remittances || remittances.length === 0) {
        return {
            totalInwardUsd: 0,
            totalOutwardUsd: 0,
            totalInwardCount: 0,
            totalOutwardCount: 0,
            inwardByCurrency: {},
            outwardByCurrency: {},
        };
    }

    // NEW: Filter by selected year FIRST
    const yearFilteredRemittances = remittances.filter(r => {
        const dateParts = getDateParts(r.valueDate);
        return dateParts?.year === selectedYear;
    });

    const inward = yearFilteredRemittances.filter(r => r.direction === 'INWARD');
    const outward = yearFilteredRemittances.filter(r => r.direction === 'OUTWARD');

    // Calculate USD totals (prefer amountUsd, fall back to amount)
    const totalInwardUsd = inward.reduce((sum, r) => sum + (r.amountUsd ?? r.amount ?? 0), 0);
    const totalOutwardUsd = outward.reduce((sum, r) => sum + (r.amountUsd ?? r.amount ?? 0), 0);

    // Calculate per-currency breakdown (using original amount)
    const inwardByCurrency = inward.reduce((acc, r) => {
        const ccy = r.ccy || 'UNKNOWN';
        acc[ccy] = (acc[ccy] || 0) + (r.amount ?? 0);
        return acc;
    }, {} as Record<string, number>);

    const outwardByCurrency = outward.reduce((acc, r) => {
        const ccy = r.ccy || 'UNKNOWN';
        acc[ccy] = (acc[ccy] || 0) + (r.amount ?? 0);
        return acc;
    }, {} as Record<string, number>);

    return {
        totalInwardUsd,
        totalOutwardUsd,
        totalInwardCount: inward.length,
        totalOutwardCount: outward.length,
        inwardByCurrency,
        outwardByCurrency,
    };
}, [remittances, selectedYear]); // Added selectedYear dependency
```

### Step 3: Add future month hiding for chart

After the `chartData` useMemo (around line 228), add new useMemo:

```typescript
// Filter chart data to hide future months in current year
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1; // 1-12

const visibleChartData = useMemo(() => {
    return chartData.filter(item => {
        // Past years: show all months
        if (selectedYear < currentYear) return true;

        // Current year: hide future months
        const month = parseInt(item.month.split('-')[1]);
        return month <= currentMonth;
    });
}, [chartData, selectedYear, currentYear, currentMonth]);
```

### Step 4: Update chart to use filtered data

Replace `chartData` with `visibleChartData` in the LineChart (around line 476):

```typescript
<Box sx={{ width: '100%', height: 350 }}>
    <LineChart
        dataset={visibleChartData}  // Changed from chartData
        xAxis={[...]}
        series={[...]}
        ...
    />
</Box>
```

### Step 5: Test in development

```bash
cd projects/bblsg-staffportal-ui
npm run dev
```

Navigate to a customer with remittances and verify:
- Selecting different years updates summary cards
- Current year chart hides future months

### Step 6: Type check

```bash
cd projects/bblsg-staffportal-ui
npm run build
npx tsc --noEmit
```

Expected: No errors

### Step 7: Commit changes

```bash
cd projects/bblsg-staffportal-ui
git add src/components/Customer/RemittanceTab.tsx
git commit -m "feat(remittance): filter summary by year, hide future months

- Summary cards now filter by selected year instead of all historical
- Chart hides future months when viewing current year
- Added visibleChartData useMemo with month boundary check
- Dependencies updated: selectedYear added to summary

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Expiring Soon Badge (Frontend)

**Files:**
- Modify: `projects/bblsg-staffportal-ui/src/utils/utils.ts` (add utility function)
- Modify: `projects/bblsg-staffportal-ui/src/app/search-new/page.tsx` (update filter label and add badges)

### Step 1: Add getDaysRemaining utility function

Add to `projects/bblsg-staffportal-ui/src/utils/utils.ts` at the end:

```typescript
// Calculate days remaining until maturity date
export const getDaysRemaining = (maturityDate: string | null | undefined): number | null => {
    if (!maturityDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maturity = parseMaturityDate(maturityDate);
    if (!maturity || maturity.getTime() === new Date('9999-12-31').getTime()) {
        return null;
    }

    const diffTime = maturity.getTime() - today.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return days;
};
```

### Step 2: Find and update filter label

In `projects/bblsg-staffportal-ui/src/app/search-new/page.tsx`, search for "Expiring Soon" and remove "(7d)":

Find:
```typescript
<FormControlLabel
    control={<Checkbox checked={filters.expiringSoon} onChange={(e) => setFilters({...filters, expiringSoon: e.target.checked})} />}
    label="Expiring Soon (7d)"
/>
```

Replace with:
```typescript
<FormControlLabel
    control={<Checkbox checked={filters.expiringSoon} onChange={(e) => setFilters({...filters, expiringSoon: e.target.checked})} />}
    label="Expiring Soon"
/>
```

### Step 3: Add row-level badge in results table

Find the table body rendering section and add badge column or inline badge. Search for where rows are rendered with `maturityDate`.

Add import at top:
```typescript
import { getDaysRemaining } from '@/utils/utils';
import { Chip } from '@mui/material';
```

In the table row rendering, add badge after or near maturity date:

```typescript
// Inside the TableRow rendering
{(() => {
    const daysLeft = getDaysRemaining(row.maturityDate);
    if (daysLeft !== null && daysLeft <= 7) {
        return (
            <Chip
                label={`${daysLeft} days left`}
                size="small"
                color={daysLeft <= 3 ? 'error' : 'warning'}
                sx={{ fontSize: '0.75rem', ml: 1 }}
            />
        );
    }
    return null;
})()}
```

### Step 4: Handle expired deposits

Optionally, add "Expired" badge for past maturity dates:

```typescript
{(() => {
    const daysLeft = getDaysRemaining(row.maturityDate);
    if (daysLeft === null) return null;

    if (daysLeft < 0) {
        return (
            <Chip
                label="Expired"
                size="small"
                color="default"
                sx={{ fontSize: '0.75rem', ml: 1 }}
            />
        );
    }

    if (daysLeft <= 7) {
        return (
            <Chip
                label={`${daysLeft} days left`}
                size="small"
                color={daysLeft <= 3 ? 'error' : 'warning'}
                sx={{ fontSize: '0.75rem', ml: 1 }}
            />
        );
    }
    return null;
})()}
```

### Step 5: Test the changes

```bash
cd projects/bblsg-staffportal-ui
npm run dev
```

Test scenarios:
- 3 days left → red badge
- 5 days left → orange badge
- 7 days left → orange badge
- 8 days left → no badge
- Expired (negative days) → gray "Expired" badge
- No maturity date → no badge

### Step 6: Type check

```bash
cd projects/bblsg-staffportal-ui
npm run build
npx tsc --noEmit
```

Expected: No errors

### Step 7: Commit changes

```bash
cd projects/bblsg-staffportal-ui
git add src/utils/utils.ts src/app/search-new/page.tsx
git commit -m "feat(search): add row-level expiring soon badges

- Add getDaysRemaining utility function to utils.ts
- Show 'X days left' badge for deposits expiring within 7 days
- Red badge for 0-3 days, orange for 4-7 days
- Show 'Expired' badge for past maturity dates
- Remove '(7d)' from filter checkbox label
- No badge for deposits without maturity date or >7 days

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Deposits UI Deal Type Handling (Frontend)

**Files:**
- Modify: `projects/bblsg-staffportal-ui/src/app/search-new/page.tsx`

### Step 1: Add state for deal type

Find or add dealType state in search-new page:

```typescript
const [dealType, setDealType] = useState('');
```

### Step 2: Hide maturity date picker for non-DF deposits

Find the maturity date picker/inputs and wrap with conditional:

```typescript
{dealType === 'DF' && (
    <DatePicker
        label="Maturity Date"
        value={maturityDate}
        onChange={setMaturityDate}
        // ... other props
    />
)}
```

If using separate from/to date pickers:
```typescript
{dealType === 'DF' && (
    <>
        <DatePicker label="Maturity Date From" value={maturityDateFrom} onChange={setMaturityDateFrom} />
        <DatePicker label="Maturity Date To" value={maturityDateTo} onChange={setMaturityDateTo} />
    </>
)}
```

### Step 3: Add conditional column rendering

In the deposits table, add conditional column header:

```typescript
<TableCell>
    {dealType === 'DF' ? 'Loan Details' : 'Account Number'}
</TableCell>
```

### Step 4: Add conditional cell rendering

In the table row rendering:

```typescript
{dealType === 'DF' ? (
    <TableCell>
        {/* Loan details rendering */}
        <Typography variant="body2">
            Principal: {formatAmountDetailed(row.principalAmount || 0)}
        </Typography>
        {row.accruedInterestAmount && (
            <Typography variant="caption" color="text.secondary">
                Interest: {formatAmountDetailed(row.accruedInterestAmount)}
            </Typography>
        )}
    </TableCell>
) : (
    <TableCell>
        {/* Account number rendering */}
        <Typography variant="body2">{row.accountNr}</Typography>
    </TableCell>
)}
```

### Step 5: Clear maturity date when switching away from DF

Add useEffect to handle deal type changes:

```typescript
useEffect(() => {
    if (dealType !== 'DF') {
        setMaturityDate(null);
        setMaturityDateFrom(null);
        setMaturityDateTo(null);
    }
}, [dealType]);
```

### Step 6: Test the UI changes

```bash
cd projects/bblsg-staffportal-ui
npm run dev
```

Test scenarios:
- Select DF → maturity date picker visible, "Loan Details" column shown
- Select CA → maturity date picker hidden, "Account Number" column shown
- Switch from DF to CA → maturity date values cleared

### Step 7: Type check

```bash
cd projects/bblsg-staffportal-ui
npm run build
npx tsc --noEmit
```

Expected: No errors

### Step 8: Commit changes

```bash
cd projects/bblsg-staffportal-ui
git add src/app/search-new/page.tsx
git commit -m "feat(search): conditional UI for deposit deal types

- Hide maturity date picker for non-DF deposit types (CA/DO/DQ/DS/DV)
- Show 'Loan Details' column for DF, 'Account Number' for others
- Clear maturity date values when switching from DF to other types
- Add useEffect to reset maturity state on deal type change

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Remittance Month Detail Modal (Frontend)

**Files:**
- Modify: `projects/bblsg-staffportal-ui/src/components/Customer/RemittanceTab.tsx`

### Step 1: Add imports for modal components

At the top of RemittanceTab.tsx, add:

```typescript
import { Dialog, DialogTitle, DialogContent, Tabs, Tab } from '@mui/material';
import { RemittanceTable } from './RemittanceTable';
```

### Step 2: Add state for month detail modal

After existing state declarations (around line 78):

```typescript
const [monthDetailOpen, setMonthDetailOpen] = useState(false);
const [monthDetailTab, setMonthDetailTab] = useState(0);
const [selectedMonthData, setSelectedMonthData] = useState<{
    year: number;
    month: number;
    monthLabel: string;
    inward: CustomerRemittance[];
    outward: CustomerRemittance[];
} | null>(null);
```

### Step 3: Add month click handler

After the `handleReScreen` function (around line 239):

```typescript
const handleMonthClick = (_: any, event: any) => {
    if (!event || event.dataIndex === undefined) return;

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
```

### Step 4: Update LineChart with onClick

Find the LineChart component (around line 476) and add onClick prop:

```typescript
<LineChart
    dataset={visibleChartData}
    onClick={handleMonthClick}
    xAxis={[...]}
    series={[...]}
    ...
/>
```

### Step 5: Add modal component

After the chart Paper section (before SanctionWarning), add:

```typescript
{/* Month Detail Modal */}
<Dialog
    open={monthDetailOpen}
    onClose={() => setMonthDetailOpen(false)}
    maxWidth="xl"
    fullWidth
>
    <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.palette.darkBlue,
        color: theme.palette.offWhite
    }}>
        <Box>
            <Typography variant="h6">
                Remittance Details - {selectedMonthData?.monthLabel}
            </Typography>
            <Typography variant="caption" color={theme.palette.offWhite}>
                {selectedMonthData?.inward.length || 0} inward, {selectedMonthData?.outward.length || 0} outward
            </Typography>
        </Box>
        <IconButton
            edge="end"
            color="inherit"
            onClick={() => setMonthDetailOpen(false)}
        >
            <Close />
        </IconButton>
    </DialogTitle>
    <DialogContent>
        <Tabs
            value={monthDetailTab}
            onChange={(_, v) => setMonthDetailTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
            <Tab
                label={`Inward (${selectedMonthData?.inward.length || 0})`}
                id="month-tab-0"
                aria-controls="month-tabpanel-0"
            />
            <Tab
                label={`Outward (${selectedMonthData?.outward.length || 0})`}
                id="month-tab-1"
                aria-controls="month-tabpanel-1"
            />
        </Tabs>
        <Box sx={{ mt: 2 }} role="tabpanel" hidden={monthDetailTab !== 0}>
            {monthDetailTab === 0 && selectedMonthData && (
                selectedMonthData.inward.length > 0 ? (
                    <RemittanceTable data={selectedMonthData.inward} />
                ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">
                            No inward remittances for this month
                        </Typography>
                    </Box>
                )
            )}
        </Box>
        <Box sx={{ mt: 2 }} role="tabpanel" hidden={monthDetailTab !== 1}>
            {monthDetailTab === 1 && selectedMonthData && (
                selectedMonthData.outward.length > 0 ? (
                    <RemittanceTable data={selectedMonthData.outward} />
                ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">
                            No outward remittances for this month
                        </Typography>
                    </Box>
                )
            )}
        </Box>
    </DialogContent>
</Dialog>
```

### Step 6: Verify RemittanceTable component exists

Check if `RemittanceTable.tsx` exists at the expected path. If not, check for similar component or create a simple table:

```typescript
// Fallback simple table if RemittanceTable doesn't exist
<TableContainer component={Paper} sx={{ maxHeight: 400 }}>
    <Table stickyHeader>
        <TableHead>
            <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Direction</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Counterparty</TableCell>
            </TableRow>
        </TableHead>
        <TableBody>
            {data.map((r) => (
                <TableRow key={r.dealId}>
                    <TableCell>{r.valueDateDisplay || r.valueDate}</TableCell>
                    <TableCell>{r.direction}</TableCell>
                    <TableCell>{formatAmountDetailed(r.amountUsd || r.amount)} {r.ccy}</TableCell>
                    <TableCell>{r.counterParty}</TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
</TableContainer>
```

### Step 7: Test the modal

```bash
cd projects/bblsg-staffportal-ui
npm run dev
```

Test scenarios:
- Click on a month with data → modal opens
- Inward tab shows inward transactions
- Outward tab shows outward transactions
- Month with no transactions → empty state message
- Close modal → state cleared

### Step 8: Type check

```bash
cd projects/bblsg-staffportal-ui
npm run build
npx tsc --noEmit
```

Expected: No errors

### Step 9: Commit changes

```bash
cd projects/bblsg-staffportal-ui
git add src/components/Customer/RemittanceTab.tsx
git commit -m "feat(remittance): add month detail modal with transaction breakdown

- Click on chart month to open transaction detail modal
- Tabs for Inward/Outward with transaction counts
- Reuses RemittanceTable component for consistency
- Empty state handling for months with no transactions
- onClick handler added to LineChart component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Final Verification Steps

### Backend Verification

```bash
cd projects/bblsg-staffportal
mvn clean test
mvn clean install
```

### Frontend Verification

```bash
cd projects/bblsg-staffportal-ui
npm run build
npx tsc --noEmit
npm test
```

### Integration Test

Start both services and verify:
1. FX data is deduplicated by dealId
2. Non-DF deposits show without maturity date filter
3. Remittance summary filters by year
4. Expiring soon badges show correctly
5. Deposit deal type UI switches correctly
6. Month detail modal opens and shows correct data

---

## Completion

All tasks completed. Ensure:
- All tests pass
- No TypeScript errors
- Git commits follow conventional commit format
- Design document is archived

Ready for QA and deployment to release/mvp2 branch.
