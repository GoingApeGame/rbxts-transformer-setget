# rbxts-transformer-setget

This transformer implements Getters and Setters to roblox-ts by converting them into methods and method calls.

Please note that this does not solve the problems pertaining to why Getters/Setters were removed from roblox-ts in the first place as detailed [here](https://github.com/roblox-ts/roblox-ts/issues/457) but should work fine if you avoid union types that have Getters/Setters.

## Usage

To use this transformer you have to add rbxts-transformer-setget to your tsconfig.json file in compilerOptions config

```json
"plugins": [
	{
		"transform": "rbxts-transformer-setget"
	}
]
```

If you use eslint you will need to add the following rule to your .eslintrc file in the rules config

```json
	"rules": {
		"roblox-ts/no-getters-or-setters": "off"
	}
```

## Example

```ts
// input.ts
class ExampleClass {
  private m_Member = 1;
  public get Member(): number {
    return this.m_Member;
  }
  public set Member(str: number) {
    this.m_Member = str;
  }
}

const example = new ExampleClass();
example.Member = 8;
print(example.Member);
```

```lua
-- output.lua
local ExampleClass
do
	ExampleClass = setmetatable({}, {
		__tostring = function()
			return "ExampleClass"
		end,
	})
	ExampleClass.__index = ExampleClass
	function ExampleClass.new(...)
		local self = setmetatable({}, ExampleClass)
		return self:constructor(...) or self
	end
	function ExampleClass:constructor()
		self.m_Member = 1
	end
	function ExampleClass:_getMember()
		return self.m_Member
	end
	function ExampleClass:_setMember(str)
		self.m_Member = str
	end
end
local example = ExampleClass.new()
example:_setMember(8)
print(example:_getMember())
```