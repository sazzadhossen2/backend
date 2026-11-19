// Shared toJSON options: expose `id` instead of `_id`, hide password and __v.
export const jsonOptions = {
  versionKey: false,
  transform: (_doc, ret) => {
    if (ret._id) ret.id = String(ret._id);
    delete ret._id;
    delete ret.password;
    return ret;
  },
};

export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
