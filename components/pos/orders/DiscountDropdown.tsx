"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, X } from "lucide-react";
import { formatCents } from "@/lib/price";

interface DiscountOption {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string; // "percentage" | "fixed"
  value: number;
  minOrderAmount?: number;
  isActive: boolean;
}

interface DiscountDropdownProps {
  departmentCode?: string;
  subtotal: number;
  appliedDiscounts: string[]; // array of discount IDs already applied
  onAddDiscount: (id: string, discount?: DiscountOption) => void;
  onRemoveDiscount: (id: string) => void;
  disabled?: boolean;
}

export function DiscountDropdown({
  departmentCode,
  subtotal,
  appliedDiscounts,
  onAddDiscount,
  onRemoveDiscount,
  disabled = false,
}: DiscountDropdownProps) {
  const [discounts, setDiscounts] = useState<DiscountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState("");

  // Fetch available discounts for this department
  useEffect(() => {
    if (!departmentCode) {
      setDiscounts([]);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    fetch(
      `/api/discounts/by-department/${encodeURIComponent(departmentCode)}`,
      { credentials: "include" }
    )
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return;

        if (json && json.success) {
          // Handle both array and paginated response formats
          const discountsList = Array.isArray(json.data)
            ? json.data
            : json.data?.discounts || json.data?.rules || [];

          // Filter to only active discounts and check minimum order amount
          const activeDiscounts = discountsList.filter(
            (d: any) =>
              d.isActive &&
              (!d.minOrderAmount || subtotal >= d.minOrderAmount)
          );

          console.log(
            `[Discount] Loaded ${activeDiscounts.length} available discounts`
          );
          setDiscounts(activeDiscounts);
        } else {
          console.warn("[Discount] Failed to load discounts:", json);
          setDiscounts([]);
        }
      })
      .catch((err) => {
        console.error("[Discount] Failed to fetch discounts:", err);
        if (mounted) {
          setError("Failed to load available discounts");
          setDiscounts([]);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [departmentCode, subtotal]);

  const handleApplyDiscount = () => {
    if (!selectedValue) return;

    const discount = discounts.find((d) => d.id === selectedValue);
    if (!discount) return;

    // Check if already applied
    if (appliedDiscounts.includes(selectedValue)) {
      setError(`"${discount.code}" is already applied`);
      return;
    }

    // Check minimum order amount
    if (discount.minOrderAmount && subtotal < discount.minOrderAmount) {
      setError(
        `Minimum order amount of ${formatCents(discount.minOrderAmount || 0)} required`
      );
      return;
    }

    console.log(`[Discount] Applying discount ID: "${selectedValue}"`, discount);
    onAddDiscount(selectedValue, discount);
    setSelectedValue("");
    setError(null);
  };

  const handleSelectChange = (value: string) => {
    setSelectedValue(value);
    setError(null);
  };

  const availableDiscounts = discounts.filter(
    (d) => !appliedDiscounts.includes(d.id)
  );

  if (!departmentCode) {
    return null;
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Apply Discount</h3>
        {loading && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading...
          </span>
        )}
        {!loading && availableDiscounts.length > 0 && (
          <span className="text-xs text-green-600">
            ✓ {availableDiscounts.length} available
          </span>
        )}
      </div>

      {error && (
        <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {availableDiscounts.length > 0 ? (
        <div className="flex gap-2">
          <Select value={selectedValue} onValueChange={handleSelectChange}>
            <SelectTrigger className="flex-1" disabled={disabled || loading}>
              <SelectValue placeholder="Select a discount code" />
            </SelectTrigger>
            <SelectContent>
              {availableDiscounts.map((discount) => {
                // Format discount value display
                const discountDisplay = 
                  discount.type === "percentage"
                    ? `${discount.value}%`
                    : discount.type === "fixed"
                    ? `${formatCents(Math.round(discount.value * 100))}`
                    : discount.type === "employee"
                    ? `Fixed - ${formatCents(Math.round(discount.value))}`
                    : `${discount.value}`;
                
                return (
                  <SelectItem key={discount.id} value={discount.id}>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{discount.code}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded capitalize">
                        {discount.type === "employee" ? "Staff" : discount.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {discountDisplay}
                      </span>
                      {discount.description && (
                        <span className="text-xs text-muted-foreground max-w-xs">
                          {discount.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Button
            onClick={handleApplyDiscount}
            disabled={!selectedValue || disabled || loading}
            className="px-6"
          >
            Apply
          </Button>
        </div>
      ) : loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading available discounts...
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          No discounts available for this order
        </div>
      )}

      {/* Applied Discounts Summary */}
      {appliedDiscounts.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-medium text-gray-600">Applied:</div>
          <div className="flex gap-2 flex-wrap">
            {appliedDiscounts.map((id) => {
              const discount = discounts.find((d) => d.id === id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 px-2 py-1 bg-green-50 border border-green-300 rounded text-sm"
                >
                  <span className="font-semibold">{discount?.code || id}</span>
                  {discount && (
                    <Badge variant="outline" className="text-xs bg-green-100">
                      {discount.type === "percentage"
                        ? `${discount.value}%`
                        : discount.type === "employee"
                        ? formatCents(Math.round(discount.value))
                        : formatCents(Math.round(discount.value * 100))}
                    </Badge>
                  )}
                  <button
                    onClick={() => onRemoveDiscount(id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Select a discount code from the dropdown to apply it to this order.
      </p>
    </div>
  );
}
