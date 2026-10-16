/** @jsxImportSource react */
// New-order form: react-hook-form + zod (@hookform/resolvers), inline errors after submit, a success message.
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { orderSchema, type OrderInput, type OrderValues } from "./schema.ts";

const EMPTY: OrderInput = { customer: "", email: "", status: "pending", total: "", date: "", gift: false, notes: "" };

export function OrderForm() {
  const [saved, setSaved] = useState<OrderValues | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrderInput, unknown, OrderValues>({ resolver: zodResolver(orderSchema), defaultValues: EMPTY });
  const error = (name: keyof OrderInput) =>
    errors[name] ? (
      <p className="error" id={name + "-error"} role="alert">
        {errors[name]?.message}
      </p>
    ) : null;
  return (
    <form
      className="order-form"
      id="order-form"
      noValidate
      onSubmit={handleSubmit((values) => {
        setSaved(values);
        reset(EMPTY);
      })}
    >
      <label>
        Customer
        <input {...register("customer")} aria-invalid={errors.customer ? true : undefined} />
      </label>
      {error("customer")}
      <label>
        Email
        <input type="email" {...register("email")} aria-invalid={errors.email ? true : undefined} />
      </label>
      {error("email")}
      <label>
        Status
        <select {...register("status")}>
          <option value="paid">paid</option>
          <option value="pending">pending</option>
          <option value="refunded">refunded</option>
          <option value="failed">failed</option>
        </select>
      </label>
      {error("status")}
      <label>
        Total (USD)
        <input inputMode="decimal" {...register("total")} aria-invalid={errors.total ? true : undefined} />
      </label>
      {error("total")}
      <label>
        Date
        <input type="date" {...register("date")} aria-invalid={errors.date ? true : undefined} />
      </label>
      {error("date")}
      <label className="check">
        <input type="checkbox" {...register("gift")} /> Gift wrap
      </label>
      <label>
        Notes
        <textarea rows={3} {...register("notes")} />
      </label>
      {error("notes")}
      <button type="submit" id="submit" disabled={isSubmitting}>
        Create order
      </button>
      {saved ? (
        <p className="toast" id="saved" role="status">
          Order for {saved.customer} saved (${saved.total.toFixed(2)})
        </p>
      ) : null}
    </form>
  );
}
