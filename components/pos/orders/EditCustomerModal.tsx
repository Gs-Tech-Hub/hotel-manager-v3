"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";

interface Customer {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface EditCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  orderId: string;
  onSuccess: () => void;
}

export function EditCustomerModal({
  open,
  onOpenChange,
  customer,
  orderId,
  onSuccess,
}: EditCustomerModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Customer>({});

  useEffect(() => {
    if (customer && open) {
      setFormData({
        firstName: customer.firstName || "",
        lastName: customer.lastName || "",
        email: customer.email || "",
        phone: customer.phone || "",
      });
      setError(null);
    }
  }, [customer, open]);

  const handleInputChange = (
    field: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!orderId) return;

    setIsUpdating(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/customer`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Give parent time to refresh order data before closing modal
        await onSuccess();
        // Add small delay for state updates to propagate
        await new Promise(resolve => setTimeout(resolve, 300));
        onOpenChange(false);
      } else {
        setError(data?.error?.message || "Failed to update customer details");
      }
    } catch (e: any) {
      console.error("Error updating customer:", e);
      setError(e?.message || "Failed to update customer details");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Customer Details</DialogTitle>
          <DialogDescription>
            Update customer information for this order.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded p-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">First Name</label>
              <input
                type="text"
                value={formData.firstName || ""}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                placeholder="First name"
                className="w-full mt-2 p-2 border rounded text-sm"
                disabled={isUpdating}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Last Name</label>
              <input
                type="text"
                value={formData.lastName || ""}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                placeholder="Last name"
                className="w-full mt-2 p-2 border rounded text-sm"
                disabled={isUpdating}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={formData.email || ""}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="Email address"
              className="w-full mt-2 p-2 border rounded text-sm"
              disabled={isUpdating}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Phone</label>
            <input
              type="tel"
              value={formData.phone || ""}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              placeholder="Phone number"
              className="w-full mt-2 p-2 border rounded text-sm"
              disabled={isUpdating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isUpdating}
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
