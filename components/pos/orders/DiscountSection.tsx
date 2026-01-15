"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { formatCents } from '@/lib/price';

interface Discount {
  id: string;
  code?: string;
  description?: string;
  discountAmount: number;
  discountType: string;
}

interface DiscountSectionProps {
  orderId: string;
  subtotal: number;
  discountTotal: number;
  tax: number;
  total: number;
  appliedDiscounts: Discount[];
  onDiscountApplied: () => void;
}

export function DiscountSection({
  orderId,
  subtotal,
  discountTotal,
  tax,
  total,
  appliedDiscounts,
  onDiscountApplied,
}: DiscountSectionProps) {
  const [discountCode, setDiscountCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountCode.trim()) return;

    setIsApplying(true);
    setApplyError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/apply-discount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: discountCode.toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to apply discount");
      }

      setDiscountCode("");
      onDiscountApplied();
    } catch (err: any) {
      setApplyError(err.message || "Failed to apply discount");
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemoveDiscount = async (discountId: string) => {
    setIsRemoving(discountId);
    setRemoveError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/discounts/${discountId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to remove discount");
      }

      onDiscountApplied();
    } catch (err: any) {
      setRemoveError(err.message || "Failed to remove discount");
    } finally {
      setIsRemoving(null);
    }
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Price Breakdown & Discounts
          </CardTitle>
          <div className="text-lg font-bold text-right">
            {formatCents(total)}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Price Summary */}
          <div className="space-y-3 border-b pb-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCents(subtotal)}</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="text-sm font-medium">Total Discounts</span>
                <span className="font-semibold">-{formatCents(discountTotal)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tax</span>
              <span className="font-medium">{formatCents(tax)}</span>
            </div>

            <div className="flex justify-between pt-2 border-t">
              <span className="font-bold">Total</span>
              <span className="text-lg font-bold">{formatCents(total)}</span>
            </div>
          </div>

          {/* Applied Discounts List */}
          {appliedDiscounts.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Applied Discounts</h3>
              <div className="space-y-2">
                {appliedDiscounts.map((discount) => (
                  <div
                    key={discount.id}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-100">
                          {discount.discountType === "percentage"
                            ? "Percentage"
                            : discount.discountType === "fixed"
                            ? "Fixed"
                            : discount.discountType}
                        </Badge>
                        <span className="font-medium">{discount.code || "Manual"}</span>
                      </div>
                      {discount.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {discount.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-green-600">
                        -{formatCents(discount.discountAmount)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveDiscount(discount.id)}
                        disabled={isRemoving === discount.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {isRemoving === discount.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Apply New Discount */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-semibold text-sm">Apply Discount Code</h3>

            {applyError && (
              <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{applyError}</p>
              </div>
            )}

            {removeError && (
              <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{removeError}</p>
              </div>
            )}

            <form onSubmit={handleApplyDiscount} className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter discount code..."
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                disabled={isApplying}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={isApplying || !discountCode.trim()}
                className="px-6"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  "Apply"
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground">
              Enter a valid discount code to apply it to this order. Discounts will be calculated based on the order subtotal.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
