import { create } from "zustand";

interface Community {
  id: number;
  name: string;
  tokens: number;
  votes: number;
  proposals: number;
}

interface User {
  email: string;
  communities: Community[];
}

interface Store {
  user: User | null;
  setUser: (user: User) => void;
  addCommunity: (community: Community) => void;
  removeCommunity: (communityId: number) => void;
}

const useStore = create<Store>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  addCommunity: (community) =>
    set((state) => ({
      user: state.user
        ? { ...state.user, communities: [...state.user.communities, community] }
        : null,
    })),
  removeCommunity: (communityId) =>
    set((state) => ({
      user: state.user
        ? {
            ...state.user,
            communities: state.user.communities.filter(
              (c) => c.id !== communityId
            ),
          }
        : null,
    })),
}));

export default useStore;
