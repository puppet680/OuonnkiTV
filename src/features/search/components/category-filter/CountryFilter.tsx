import { useState } from 'react'
import type { TmdbCountry, TmdbFilterOptions } from '@/shared/types/tmdb'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/shared/components/ui/drawer'
import { FilterChip, MoreButton, WrapFilterRow } from './MediaTypeFilter'
import { getCountryChineseName, POPULAR_COUNTRIES_MOBILE, MAJOR_COUNTRIES } from '../../constants'

interface CountryFilterProps {
  /** 国家列表 */
  countries: TmdbCountry[]
  /** 当前筛选条件 */
  filterOptions: TmdbFilterOptions
  /** 筛选条件变更回调 */
  onFilterChange: (options: Partial<TmdbFilterOptions>) => void
}

/**
 * 国家/地区筛选组件
 * 移动端显示常用国家 + 更多按钮，桌面端显示前20个国家
 */
export function CountryFilter({
  countries,
  filterOptions,
  onFilterChange,
}: CountryFilterProps) {
  const [isCountryDrawerOpen, setIsCountryDrawerOpen] = useState(false)

  // 只保留主流国家，过滤偏门地区
  const filteredCountries = countries.filter(c => MAJOR_COUNTRIES.includes(c.iso_3166_1))

  // 排序国家列表，常用国家优先
  const sortedCountries = [...filteredCountries].sort((a, b) => {
    const aIndex = POPULAR_COUNTRIES_MOBILE.indexOf(a.iso_3166_1)
    const bIndex = POPULAR_COUNTRIES_MOBILE.indexOf(b.iso_3166_1)
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return getCountryChineseName(
      a.iso_3166_1,
      a.native_name,
      a.english_name,
    ).localeCompare(
      getCountryChineseName(b.iso_3166_1, b.native_name, b.english_name),
    )
  })

  // 常用国家（移动端只显示6个）
  const popularCountries = sortedCountries.filter(c =>
    POPULAR_COUNTRIES_MOBILE.includes(c.iso_3166_1),
  )
  const otherCountries = sortedCountries.filter(
    c => !POPULAR_COUNTRIES_MOBILE.includes(c.iso_3166_1),
  )

  // 计算当前选中的其他国家数量（用于显示红点提示）
  const selectedOtherCountriesCount = filterOptions.originCountry
    ? otherCountries.filter(c => c.iso_3166_1 === filterOptions.originCountry).length
    : 0

  return (
    <>
      {/* 移动端：常用国家 + 更多按钮 */}
      <div className="md:hidden">
        <WrapFilterRow label="地区">
          <FilterChip
            label="全部"
            isSelected={!filterOptions.originCountry}
            onClick={() => onFilterChange({ originCountry: undefined })}
          />
          {popularCountries.map(country => (
            <FilterChip
              key={country.iso_3166_1}
              label={getCountryChineseName(
                country.iso_3166_1,
                country.native_name,
                country.english_name,
              )}
              isSelected={filterOptions.originCountry === country.iso_3166_1}
              onClick={() =>
                onFilterChange({ originCountry: country.iso_3166_1 })
              }
            />
          ))}
          {otherCountries.length > 0 && (
            <Drawer open={isCountryDrawerOpen} onOpenChange={setIsCountryDrawerOpen}>
              <DrawerTrigger asChild>
                <div>
                  <MoreButton
                    count={otherCountries.length}
                    isSelected={selectedOtherCountriesCount > 0}
                  />
                </div>
              </DrawerTrigger>
              <DrawerContent className="max-h-[70vh]">
                <DrawerHeader>
                  <DrawerTitle>选择地区</DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto p-4">
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      label="全部地区"
                      isSelected={!filterOptions.originCountry}
                      onClick={() => {
                        onFilterChange({ originCountry: undefined })
                        setIsCountryDrawerOpen(false)
                      }}
                    />
                    {sortedCountries.map(country => (
                      <FilterChip
                        key={country.iso_3166_1}
                        label={getCountryChineseName(
                          country.iso_3166_1,
                          country.native_name,
                          country.english_name,
                        )}
                        isSelected={filterOptions.originCountry === country.iso_3166_1}
                        onClick={() => {
                          onFilterChange({ originCountry: country.iso_3166_1 })
                          setIsCountryDrawerOpen(false)
                        }}
                      />
                    ))}
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          )}
        </WrapFilterRow>
      </div>

      {/* 桌面端：前20个国家 */}
      <div className="hidden md:block">
        <WrapFilterRow label="地区">
          <FilterChip
            label="全部"
            isSelected={!filterOptions.originCountry}
            onClick={() => onFilterChange({ originCountry: undefined })}
          />
          {sortedCountries.slice(0, 20).map(country => (
            <FilterChip
              key={country.iso_3166_1}
              label={getCountryChineseName(
                country.iso_3166_1,
                country.native_name,
                country.english_name,
              )}
              isSelected={filterOptions.originCountry === country.iso_3166_1}
              onClick={() => onFilterChange({ originCountry: country.iso_3166_1 })}
            />
          ))}
        </WrapFilterRow>
      </div>
    </>
  )
}

// ponytail: MoreButton & WrapFilterRow moved to MediaTypeFilter
